import re

with open("public/index.html", "r", encoding="utf-8") as f:
    lines = f.readlines()

emoji_pattern = re.compile(r'[\U00010000-\U0010ffff]', flags=re.UNICODE)

with open("emojis_list.txt", "w", encoding="utf-8") as out:
    for i, line in enumerate(lines):
        if emoji_pattern.search(line):
            out.write(f"Line {i+1}: {line.strip()}\n")
