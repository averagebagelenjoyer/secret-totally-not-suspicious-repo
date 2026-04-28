async function aesEncrypt(text, password) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.digest("SHA-256", enc.encode(password));
    const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, enc.encode(text));

    return btoa(JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) }));
}

async function aesDecrypt(encoded, password) {
    const { iv, data } = JSON.parse(atob(encoded));
    const enc = new TextEncoder();
    const key = await crypto.subtle.digest("SHA-256", enc.encode(password));
    const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);

    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(iv) },
        cryptoKey,
        new Uint8Array(data)
    );

    return new TextDecoder().decode(decrypted);
}

const chat = document.getElementById("chat");

async function get() {
    const res = await fetch(`${CONFIG.API}?action=get`, {
        method: "GET"
    });
    const data = res.text();

    return data;
}

async function send(message) {
    fetch(`${CONFIG.API}?action=send&text=${message}&name=${CONFIG.NICKNAME}`, {
        method: "GET"
    });
}

(async function mainLoop() {
    try {
        let text = await get();
        text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const lines = text.split("\n");

        const html = await Promise.all(
            lines.map(async line => {
                const [user, ...rest] = line.split(";");
                const message = rest.join(";");
                const decrypted = await aesDecrypt(message, CONFIG.KEY);
                return `<div>${user}: <msg>${decrypted}</msg></div>`;
            })
        );

        chat.innerHTML = chat.innerHTML = html.join("\n");;
    } catch {
        chat.innerHTML = "<div>huh, that's an error. well either wait or contact your local system administrator.</div>";
    }

    mainLoop();
})();

const input = document.getElementById("msg");

async function sendBtn() {
    if (input.value) { send(await aesEncrypt(input.value, CONFIG.KEY)); }
    input.value = "";
}
input.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        document.getElementById("send").click()
    }
})
