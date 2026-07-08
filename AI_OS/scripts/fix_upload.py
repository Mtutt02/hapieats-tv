with open('components/upload/UploadStudio.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("{step === 'trim' && file && (", "{step === 'trim' && files.length > 0 && (")
content = content.replace("{step === 'details' && file && (", "{step === 'details' && files.length > 0 && (")
content = content.replace("file={file}", "files={files}")
content = content.replace("{file.name}", "{files[0].name}")
content = content.replace("{file.size > 8 * 1024 ** 3 && (", "{files[0].size > 8 * 1024 ** 3 && (")
content = content.replace("onClick={() => { setFile(null); setStep('file') }}", "onClick={() => { setFiles([]); setStep('file') }}")

with open('components/upload/UploadStudio.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
