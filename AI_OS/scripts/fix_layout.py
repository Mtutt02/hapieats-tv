with open('components/editor/EditorPanel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Change split layout to stacked
old = '      {/* SPLIT LAYOUT: Video preview (left) + Controls (right) */}\n      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3">\n        {/* LEFT: Video Preview with draggable overlays */}'
new = '      {/* Video preview (full width) */}\n      <div className="space-y-3">\n        {/* Video Preview */}'
content = content.replace(old, new)

# Remove the RIGHT comment
old = '        {/* RIGHT: Tab bar + panel content */}'
new = '        {/* Tab bar + panel content */}'
content = content.replace(old, new)

# Close the stacked layout - find "End split layout" and replace
old = '      {/* End split layout */}'
new = '      </div>\n      {/* End stacked layout */}'
content = content.replace(old, new)

with open('components/editor/EditorPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
