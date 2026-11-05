import json

with open('public/assets/aistudio/backup_02c20555.json', 'r') as f:
    data = json.load(f)

# Find Cache map
cache_map = None
other_maps = []
for m in data.get('maps', []):
    if m.get('id') == 'cache':
        cache_map = m
    else:
        other_maps.append(m)

if cache_map:
    # Reorder maps
    data['maps'] = [cache_map] + other_maps
    
    # Reorder favorites
    favs = data.get('settings', {}).get('favorites', [])
    if 'cache' in favs:
        favs.remove('cache')
    data['settings']['favorites'] = ['cache'] + favs

with open('public/assets/aistudio/backup_02c20555.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
