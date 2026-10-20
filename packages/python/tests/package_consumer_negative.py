"""Must fail installed typing: missing path input, wrong ID type, nullable data."""
from bota_api_sdk import BotaApiClient


async def rejected(client: BotaApiClient) -> None:
    await client.get_devices_by_id()
    await client.get_devices_by_id({"path": {"id": 7}})
    identity = await client.get_auth_identity()
    project: str = identity.data["project_id"]
    print(project)
    await client.post_end_users({})
    await client.patch_end_users_by_id({"body": {}})
    await client.post_end_users({"body": {}}, {"max_retries": 1})
    await client.patch_end_users_by_id({"path": {"id": 7}, "body": {}})
