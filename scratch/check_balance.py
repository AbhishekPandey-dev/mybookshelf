
def check_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    braces = []
    parens = []
    for i, char in enumerate(content):
        if char == '{': braces.append(i)
        elif char == '}': 
            if braces: braces.pop()
            else: print(f"Unbalanced }} at position {i}")
        elif char == '(': parens.append(i)
        elif char == ')': 
            if parens: parens.pop()
            else: print(f"Unbalanced ) at position {i}")
            
    if braces:
        for b in braces:
            print(f"Unclosed {{ at position {b}")
            # print surrounding text
            print(content[max(0, b-20):min(len(content), b+100)])
            print("---")
    if parens:
        for p in parens:
            print(f"Unclosed ( at position {p}")
            print(content[max(0, p-20):min(len(content), p+100)])
            print("---")

check_balance(r"c:\Users\X\Desktop\harry\mybooks\src\pages\Index.tsx")
