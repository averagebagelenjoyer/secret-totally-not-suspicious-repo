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
const lastMsg = document.getElementById("lastMsg");

async function get() {
    const res = await fetch(`${CONFIG.API}`, {
        method: "GET"
    });
    const data = res.text();

    return data;
}

function send(message, nickname = CONFIG.NICKNAME) {
    fetch(`${CONFIG.API}`, {
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({
            text: message,
            name: nickname
        })
    });
}

(async function mainLoop() {
    try {
        let text = await get();

        const lines = text.split("\n");
        const lastLines = lines.slice(-50);

        const html = await Promise.all(
            lastLines.map(async line => {
                const [user, ...rest] = line.split(";");
                const message = rest.join(";");
                let decrypted = await aesDecrypt(message, CONFIG.KEY);

                if (user.slice(0, 7) == "FILEMAN") {
                    const blob = new Blob([decrypted], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const filename = user.slice(8) || "file";

                    return `<div>FILEMAN: <msg><a href="${url}" download="${filename}">${filename}</a></msg></div>`;
                } else {
                    decrypted = decrypted.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    return `<div>${user}: <msg>${decrypted}</msg></div>`;
                }
            })
        );

        chat.innerHTML = html.join("\n");

        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        lastMsg.innerText = `Last Received ${hours}:${minutes}:${seconds}`;
    } catch (e) {
        chat.innerHTML = "<div>huh, that's an error. well either wait or contact your local system administrator.</div>";
        console.error(e);
    }

    mainLoop();
})();

const msg = document.getElementById("msg");
async function msgBtn() {
    if (msg.value) { send(await aesEncrypt(msg.value, CONFIG.KEY)); }
    msg.value = "";
}
msg.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        document.getElementById("msgBtn").click()
    }
})

const fileInput = document.getElementById("file");
async function fileBtn() {
    if (fileInput.value) {
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async () => {
            const encryptedFile = await aesEncrypt(reader.result, CONFIG.KEY);

            send(encryptedFile, `FILEMAN-${file.name}`)

            fileInput.value = "";
        };

        reader.readAsText(file);
    }
}
