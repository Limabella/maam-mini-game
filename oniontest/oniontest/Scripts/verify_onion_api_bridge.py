import json
import os
import urllib.request

import unreal


OUTPUT_PATH = os.path.join(
    unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()),
    "OnionApiBridgeVerification.json",
)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def log(message):
    unreal.log(f"[OnionApiBridge] {message}")


def main():
    http_proxy = unreal.load_class(
        None,
        "/Script/HttpBlueprint.HttpRequestProxyObject",
    )
    json_library = unreal.load_class(
        None,
        "/Script/JsonBlueprintUtilities.JsonBlueprintFunctionLibrary",
    )
    require(http_proxy is not None, "HttpBlueprint runtime class is not loaded")
    require(json_library is not None, "JsonBlueprintUtilities runtime class is not loaded")

    with urllib.request.urlopen("http://127.0.0.1:8765/health", timeout=3) as response:
        health = json.loads(response.read().decode("utf-8"))
    require(health.get("status") == "ok", "ONN-C health endpoint is not ready")
    require(health.get("schema_version") == "onn-c.v1", "Unexpected ONN-C schema")

    character = "/Game/Onion/Character/onn_24motion"
    placeable = "/Game/Onion/Blueprints/BP_OnionPlaceable"
    require(unreal.EditorAssetLibrary.does_asset_exist(character), f"Missing {character}")
    require(unreal.EditorAssetLibrary.does_asset_exist(placeable), f"Missing {placeable}")

    animations = unreal.EditorAssetLibrary.list_assets(
        "/Game/Onion/Animations",
        recursive=True,
        include_folder=False,
    )
    require(len(animations) == 24, f"Expected 24 Onion animations, got {len(animations)}")

    result = {
        "engine_version": unreal.SystemLibrary.get_engine_version(),
        "http_blueprint": True,
        "json_blueprint_utilities": True,
        "api_status": health["status"],
        "schema_version": health["schema_version"],
        "character_asset": character,
        "placeable_blueprint": placeable,
        "animation_count": len(animations),
    }
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)

    log(json.dumps(result, ensure_ascii=False))
    log(f"Verification saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
