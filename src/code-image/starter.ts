// The code the pad opens with at code-image: a Python function that turns code into the iframe to paste into a question.
// Skulpt's base64 module is not implemented, so the function carries its own few lines of base64.
// `site` is the address of the folder this page is served from, so the iframe it makes loads the same version.
export function starterCode(site: string): string {
  return `# Code as an image: makes an iframe that shows your code as a picture, so it cannot
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
SITE = "${site}"  # the version that draws it: for an exam, use an exact one such as v1.1.0

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
`;
}
