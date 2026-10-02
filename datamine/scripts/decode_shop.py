"""Decode the game's local shop cache (every pack the client has been sent) into data/shop_packs.json.

Files: %USERPROFILE%/AppData/LocalLow/Hit_Zone/Invokers/shop/
  packs/<packId>.dat   one ShopPack each (MemoryPack version-tolerant object, no format byte)
  skus.dat, skus_prices.dat   store product list and the player's local store prices (not exported: they are the
                              player's own currency and region)

ShopPack members by position (removed fields stay as empty slots):
  0 PackId (i64), 1 Revision, 2 Kind (PackKind), 3 Type (PackType), 4 PurchaseLimit, 5 PurchaseLimitCount,
  6 DurationHours (double?), 7 Price {1 ResourcePrice, 2 ProductSku, 3 UsdPrice (int?)}, 11 UniqueId (enum?),
  12 InstantReward (list of IShopRewardItem), 14 VisualSettings, 15 ReplacesPackId (long?), 16 PurchaseLimitInterval,
  17 OnlinePurchaseOnly, 18 AccountPurchaseLimit, 20 LocalizationBytes (i32 length + Brotli of a list of
  ShopPackLocalization {0 LongName, 1 Description, 2 ShortName, 20 Language}), 21 RewardSteps
  (dictionary int -> ShopRewardStep {1 Rewards, 2 Action, 3 Condition, 4 RequiredAmount, 5 RequiresStepKeys}).
IShopRewardItem is a MemoryPack union: [tag byte][object]; the tag picks the reward type (TAGS below).

Usage: python decode_shop.py [shop_dir]
"""
import json
import os
import struct
import sys
from datetime import date
from pathlib import Path

import brotli

from memorypack import Reader, i32, i64

REPO = Path(__file__).resolve().parents[2]
SHOP = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(os.environ["USERPROFILE"]) / "AppData/LocalLow/Hit_Zone/Invokers/shop"
RESOURCE_IDS = {v: k for k, v in json.loads((Path(__file__).parent / "resource_type_ids.json").read_text(encoding="utf-8")).items()}

ENUMS = {
    "PackKind": {1: "Fixed", 2: "Promo", 3: "Trigger"},
    "PackType": {1: "Default", 2: "Progression", 3: "Retention", 4: "MultipleChoice", 5: "Double", 6: "Triple",
                 7: "Chain", 8: "Customisable", 9: "FaqReward", 1000: "Subscription"},
    "PurchaseLimit": {1: "Unlimited", 2: "OneUntilActive", 3: "PerHour", 4: "PerDay", 5: "PerWeek", 6: "PerMonth",
                      7: "PerAccount", 8: "PerAccountWithDuration", 9: "Cooldown"},
    "ShopPackTab": {0: None, 1: "Exclusive", 2: "SpecialOffers", 4: "Currency", 5: "GemShop", 6: "WorldProgression",
                    7: "HotDeals", 8: "Retention"},
    "RewardAction": {0: None, 1: "Login", 2: "LevelComplete"},
    "ShopPackPlatform": {0: "All", 1: "Mobile", 2: "Desktop", 4: "Web"},
}
ENGLISH = 1  # Language.en_US


def string(b, pos=0):
    """MemoryPack string: i32 header (~utf8 byte length when negative, then i32 utf16 length), then UTF-8 bytes."""
    n = struct.unpack_from("<i", b, pos)[0]
    if n == -1:
        return None, pos + 4
    if n < 0:
        size = ~n
        return b[pos + 8:pos + 8 + size].decode("utf-8"), pos + 8 + size
    return b[pos + 4:pos + 4 + 2 * n].decode("utf-16-le"), pos + 4 + 2 * n


def nullable_int(b):
    return i32(b[4:8]) if b and b[0] else None


def resources_dict(b):
    """ImmutableResources: object whose member 0 is a dictionary ResourceTypeId -> int."""
    o = Reader(b).object() if b else None
    if not o or not o[0]:
        return {}
    r = Reader(o[0])
    n = r.i32()
    return {RESOURCE_IDS.get(k, str(k)): v for k, v in ((r.i32(), r.i32()) for _ in range(max(0, n)))}


def reward_item(r):
    tag = r.u8()
    o = r.object()
    if o is None:
        return None
    secondary = bool(o[0][0]) if o[0] else False
    if tag == 2:  # ResourceShopRewardItem {IsSecondary, ResourceTypeId, Value}
        item = {"type": "resource", "id": RESOURCE_IDS.get(i32(o[1]), str(i32(o[1]))), "amount": i32(o[2])}
    elif tag == 0 and len(o) == 2:  # XpShopRewardItem {IsSecondary, Value}
        item = {"type": "xp", "amount": i32(o[1])}
    else:
        item = {"type": f"tag{tag}", "raw": [x.hex() for x in o]}
    if secondary:
        item["secondary"] = True
    return item


def reward_list(b):
    if not b:
        return []
    r = Reader(b)
    n = r.i32()
    return [reward_item(r) for _ in range(max(0, n))]


def reward_steps(b):
    if not b:
        return []
    r = Reader(b)
    n = r.i32()
    steps = []
    for _ in range(max(0, n)):
        key = r.i32()
        o = r.object()
        steps.append({"step": key, "rewards": reward_list(o[1]) if len(o) > 1 else [],
                      "action": ENUMS["RewardAction"].get(i32(o[2])) if len(o) > 2 and o[2] else None,
                      "requiredAmount": i32(o[4]) if len(o) > 4 and o[4] else None})
    return steps


def localization(b):
    if not b:
        return {}
    raw = brotli.decompress(b[4:])
    r = Reader(raw)
    for _ in range(r.i32()):
        o = r.object()
        if o and len(o) > 20 and o[20] and i32(o[20]) == ENGLISH:
            return {"name": string(o[0])[0] if o[0] else None, "description": string(o[1])[0] if o[1] else None,
                    "shortName": string(o[2])[0] if o[2] else None}
    return {}


def pack(path):
    m = Reader(path.read_bytes()).object()
    price = Reader(m[7]).object() if m[7] else []
    vis = Reader(m[14]).object() if m[14] else []
    duration = struct.unpack_from("<d", m[6], 8)[0] if m[6] and m[6][0] else None
    p = {"id": i64(m[0]), **localization(m[20] if len(m) > 20 else b""),
         "kind": ENUMS["PackKind"].get(i32(m[2])), "type": ENUMS["PackType"].get(i32(m[3])),
         "tab": ENUMS["ShopPackTab"].get(i32(vis[5])) if len(vis) > 5 and vis[5] else None,
         "price": {"usd": nullable_int(price[3]) if len(price) > 3 else None,
                   "sku": string(price[2])[0] if len(price) > 2 and price[2] else None,
                   "resources": resources_dict(price[1]) if len(price) > 1 else {}},
         "rewards": reward_list(m[12]),
         "steps": reward_steps(m[21]) if len(m) > 21 else [],
         "purchaseLimit": ENUMS["PurchaseLimit"].get(i32(m[4])), "purchaseLimitCount": i32(m[5]),
         "durationHours": duration,
         "discount": nullable_int(vis[3]) if len(vis) > 3 else None,
         "bonus": nullable_int(vis[4]) if len(vis) > 4 else None,
         "artLayout": string(vis[13])[0] if len(vis) > 13 and vis[13] else None,
         "platform": ENUMS["ShopPackPlatform"].get(i32(vis[16])) if len(vis) > 16 and vis[16] else None}
    if len(m) > 15 and m[15] and m[15][0]:
        p["replacesPackId"] = i64(m[15][8:16])
    return {k: v for k, v in p.items() if v not in (None, [], {})}


def main():
    packs = sorted((pack(f) for f in (SHOP / "packs").glob("*.dat")), key=lambda p: p["id"])
    manifest = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))
    out = {"gameVersion": manifest["gameVersion"], "extractedAt": date.today().isoformat(),
           "source": "The game's local shop cache (every pack the server has sent this client).",
           "packs": packs}
    (REPO / "data" / "shop_packs.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"data/shop_packs.json: {len(packs)} packs")


if __name__ == "__main__":
    main()
