// 英単語の発音（ブラウザ内蔵のWeb Speech APIを使用。追加の通信・APIキーは不要）
function medetySpeak(text) {
    if (!text || !("speechSynthesis" in window)) return;
    try {
        window.speechSynthesis.cancel(); // 前の発音が残っていたら止めてから話す
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "en-US";
        utter.rate = 0.9;
        window.speechSynthesis.speak(utter);
    } catch (e) {
        console.error("発音の再生に失敗:", e);
    }
}
