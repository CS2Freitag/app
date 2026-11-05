import json

# File paths
backup_path = '/app/applet/public/assets/aistudio/backup_02c20555.json'
cache_update_path = '/app/applet/public/assets/aistudio/map_c98e7a58.json'

# Load files
with open(backup_path, 'r') as f:
    backup = json.load(f)

with open(cache_update_path, 'r') as f:
    cache_data = json.load(f)

new_cache_map = cache_data['map']

# Update maps array
maps = backup.get('maps', [])
found = False
for i, m in enumerate(maps):
    if m.get('id') == 'cache':
        maps[i] = new_cache_map
        found = True
        break

if not found:
    maps.insert(0, new_cache_map)
else:
    # Reorder to put cache first
    cache_map = None
    other_maps = []
    for m in maps:
        if m.get('id') == 'cache':
            cache_map = m
        else:
            other_maps.append(m)
    
    if cache_map:
        backup['maps'] = [cache_map] + other_maps

# Update favorites
favorites = backup.get('settings', {}).get('favorites', [])
if 'cache' in favorites:
    favorites.remove('cache')
favorites.insert(0, 'cache')
backup['settings']['favorites'] = favorites

# Save updated backup
with open(backup_path, 'w') as f:
    json.dump(backup, f, indent=2)

print("Backup updated successfully.")
