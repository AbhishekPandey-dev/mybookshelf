
with open(r"c:\Users\X\Desktop\harry\mybooks\src\pages\Index.tsx", "r", encoding="utf-8") as f:
    content = f.read()

stack = []
for i, char in enumerate(content):
    if char == "{":
        stack.append(("{", i))
    elif char == "}":
        if not stack:
            print(f"Extra closing brace at index {i}")
            print(content[max(0, i-20):i+20])
        else:
            stack.pop()
    elif char == "(":
        stack.append(("(", i))
    elif char == ")":
        if not stack:
            print(f"Extra closing paren at index {i}")
            print(content[max(0, i-20):i+20])
        else:
            stack.pop()

if stack:
    for s, i in stack:
        print(f"Unclosed {s} at index {i}")
        print(content[i:i+40])
