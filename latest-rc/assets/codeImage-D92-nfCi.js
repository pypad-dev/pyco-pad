import{a as e,i as t,n,o as r,r as i}from"./format-BgYY1c_L.js";var a=`14px Consolas, Monaco, 'Courier New', monospace`,o=22.4,s={background:`#1e1e1e`,plain:`#d4d4d4`,keyword:`#569cd6`,string:`#ce9178`,fstring:`#f44747`,comment:`#6a9955`,number:`#b5cea8`,decorator:`#c586c0`};function c(e){let t=new DOMParser().parseFromString(`<body>`+r(e)+`</body>`,`text/html`).body,n=[[]],i=(e,t)=>{if(e.nodeType===Node.TEXT_NODE)(e.textContent??``).split(`
`).forEach((e,r)=>{r>0&&n.push([]),e&&n[n.length-1].push({text:e.replace(/\t/g,`    `),color:t})});else if(e instanceof HTMLElement){let n=[...e.classList].find(e=>e.startsWith(`token-`)),r=e.style.color?s.plain:n?s[n.slice(6)]??t:t;e.childNodes.forEach(e=>i(e,r))}};return t.childNodes.forEach(e=>i(e,s.plain)),n}function l(e,t){e.font=a;let n=Math.max(0,...t.map(t=>t.reduce((t,n)=>t+e.measureText(n.text).width,0)));return Math.ceil(n+40)}function u(e,t,n,r){e.fillStyle=s.background,e.fillRect(0,0,n,r),e.font=a,e.textBaseline=`top`,t.forEach((t,n)=>{let r=20,i=20+n*o;for(let{text:n,color:a}of t)e.fillStyle=a,e.fillText(n,r,i),r+=e.measureText(n).width})}function d(e,t){let n=e.getContext(`2d`),r=l(n,t),a=i(t.length),o=window.devicePixelRatio||1;e.width=r*o,e.height=a*o,e.style.width=r+`px`,e.style.height=a+`px`,n.scale(o,o),u(n,t,r,a)}function f(e){return`# Code as an image: makes an iframe that shows your code as a picture, so it cannot
# be selected or copied. Put your code between the triple quotes, press Run, and
# paste the iframe from the output into the question. (Screenshots still work.)
# ALT is read aloud by screen readers: leave it empty to say only that it is code.

CODE = """
for val in range(6):
    if val <= 3:
        print("cat")
    elif val == 2:
        print("dog")
"""
ALT = ""
SITE = "${e}"  # the version that draws it: for an exam, use an exact one such as v1.1.0

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"


def base64url(data):
    out = ""
    for i in range(0, len(data), 3):
        chunk = list(data[i:i + 3])
        n = len(chunk)
        chunk += [0] * (3 - n)
        value = (chunk[0] << 16) | (chunk[1] << 8) | chunk[2]
        for k in range(n + 1):
            out += ALPHABET[(value >> (18 - 6 * k)) & 63]
    return out


def percent(text):
    out = ""
    for byte in text.encode("utf-8"):
        c = chr(byte)
        if byte < 128 and (c.isalnum() or c in "-_.~"):
            out += c
        else:
            out += "%%%02X" % byte
    return out


def code_image_iframe(code, alt=""):
    code = code.strip("\\n")
    data = base64url(code.encode("utf-8"))
    if alt:
        data += "&alt=" + percent(alt)
    height = -(-((code.count("\\n") + 1) * 224 + 400) // 10)
    return ('<iframe src="' + SITE + '/code-image#' + data + '" title="Code (image)" '
            'width="100%" height="' + str(height) + '" style="border:0"></iframe>')


print(code_image_iframe(CODE, ALT))
`}var p=t(location.hash);if(p===null)location.replace(`./#b=`+n(f(e(location.href))));else if(p.ok){let e=document.getElementById(`image`);d(e,c(p.code)),e.setAttribute(`role`,`img`),e.setAttribute(`aria-label`,p.alt||`Code, shown as an image`),e.hidden=!1}else{let e=document.getElementById(`message`);e.textContent=`This code image cannot be read.`,e.hidden=!1}window.addEventListener(`hashchange`,()=>location.reload());