

const gasUrl = "https://script.google.com/macros/s/AKfycbwwW5MAh3ceQvnkbxG5A3aOjEpOJmF2r_vqZ2i0Jt_dJjlQk1iIsNG3z1LMwwN4meVl/exec";


// データを「取ってくるだけ」の関数にする（使い回しやすくするため）
async function loadMedetyData() {
    console.log("読み込み開始...");

    // 1. キャッシュをチェック
    const cachedData = localStorage.getItem("medetyData");
    let data = cachedData ? JSON.parse(cachedData) : null;

    if (data) {
        console.log("キャッシュからデータを復元しました");
        // キャッシュがあれば、まずはそれを返す（待たせない！）
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