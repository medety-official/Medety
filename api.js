

const gasUrl = "https://script.google.com/macros/s/AKfycbwwW5MAh3ceQvnkbxG5A3aOjEpOJmF2r_vqZ2i0Jt_dJjlQk1iIsNG3z1LMwwN4meVl/exec";

// 同じページ内で loadMedetyData() が何度呼ばれても通信は1回だけにするためのキャッシュ
let medetyDataPromise = null;

async function fetchMedetyData() {
    // 1. キャッシュをチェック
    const cachedData = localStorage.getItem("medetyData");
    let data = cachedData ? JSON.parse(cachedData) : null;

    if (data) {
        console.log("キャッシュからデータを復元しました");
        // キャッシュがあれば、まずはそれを返す(待たせない!)
    }

    // 2. 裏側で最新データを取得
    try {
        const response = await fetch(gasUrl);
        const newData = await response.json();
        localStorage.setItem("medetyData", JSON.stringify(newData));
        console.log("最新データを保存しました");

        // キャッシュがなかった場合は最新データを返す
        if (!data) data = newData;
    } catch (error) {
        console.error("最新データの取得に失敗:", error);
    }

    return data; // { words: [...], etymology: [...] } が返る
}

// データを「取ってくるだけ」の関数にする(使い回しやすくするため)
function loadMedetyData() {
    console.log("読み込み開始...");
    if (!medetyDataPromise) {
        medetyDataPromise = fetchMedetyData();
    }
    return medetyDataPromise;
}

// ===== 遊ぶモードのランキング =====
// GAS側にdoPostを追加してもらう必要がある（詳細はGASスクリプトの追記案を参照）。
// Content-Typeをtext/plainにしてpreflight(OPTIONS)を発生させないのがポイント。
async function submitPlayScore(payload) {
    try {
        const res = await fetch(gasUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(Object.assign({ action: "submitScore" }, payload)),
        });
        return await res.json();
    } catch (error) {
        console.error("スコア送信に失敗:", error);
        return { ok: false, error: String(error) };
    }
}

async function fetchRanking() {
    try {
        const res = await fetch(`${gasUrl}?action=ranking`);
        return await res.json();
    } catch (error) {
        console.error("ランキング取得に失敗:", error);
        return { ranking: [] };
    }
}
