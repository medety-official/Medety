
let correctCount = 0 //初出で正解した数（＝これまでと同じ意味のスコア）
let streak = 0 //現在の連続正解数
let words = [];
let etymology = [];
let selectedWords = [];
let currentWord; //現在出題中の単語

// ✕にした問題を正解するまで繰り返し出題するためのキュー方式
// studyQueue: まだ「一度も正解していない」単語（末尾に積み直される）
// totalUniqueWords: 出題開始時点でのユニークな単語数（進捗表示の分母）
// missedWordsSet: 一度でも✕にしたことがある単語（初出正解かどうかの判定用）
let studyQueue = [];
let totalUniqueWords = 0;
let missedWordsSet = new Set();
let quizHistoryLog = []; // 出題結果の振り返りページ用の履歴

// コース学習は coursequiz.html + course.js が専用で担当するため、ここでは扱わない

const cheerMessages = ["やったね！", "その調子！", "素晴らしい！", "ナイス！", "いいね！"];

// 指定した要素にアニメーション用クラスを付け直す（連続で発火してもリセットされるように）
function playCardAnim(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth; // 強制リフローでアニメーションを再始動させる
    el.classList.add(className);
    el.addEventListener("animationend", () => el.classList.remove(className), { once: true });
}

// 正解時にふわっと浮かぶ応援テキストを表示する
function spawnCheerText(text) {
    const layer = document.getElementById("effectLayer");
    if (!layer) return;
    const el = document.createElement("div");
    el.className = "medety-cheer-pop";
    el.textContent = text;
    layer.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
}

// 連続正解数（ストリーク）バッジの表示を更新する
function updateStreakBadge() {
    const badge = document.getElementById("streakBadge");
    const num = document.getElementById("streakNum");
    if (!badge || !num) return;

    if (streak >= 2) {
        num.textContent = streak;
        badge.style.display = "inline-flex";
        playCardAnim(badge, "medety-anim-pop");
    } else {
        badge.style.display = "none";
    }
}

// ===== 音（Web Audio APIで簡易生成。追加ファイル不要） =====
let quizAudioCtx = null;
function ensureQuizAudio() {
    if (!quizAudioCtx) {
        try { quizAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { quizAudioCtx = null; }
    } else if (quizAudioCtx.state === "suspended") {
        quizAudioCtx.resume();
    }
}
function playQuizTone(freq, duration, type, vol) {
    if (!quizAudioCtx) return;
    const osc = quizAudioCtx.createOscillator();
    const gain = quizAudioCtx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.16, quizAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, quizAudioCtx.currentTime + duration);
    osc.connect(gain).connect(quizAudioCtx.destination);
    osc.start();
    osc.stop(quizAudioCtx.currentTime + duration);
}
function sfxQuizCorrect() { playQuizTone(880, 0.12, "triangle", 0.16); setTimeout(() => playQuizTone(1320, 0.14, "triangle", 0.16), 80); }
function sfxQuizWrong() { playQuizTone(180, 0.28, "sawtooth", 0.15); }

async function initMedety() {
    const data = await loadMedetyData();
    if (data) {
        words = data.words;
        etymology = data.etymology;
        startQuiz();
    }
    document.getElementById("loading").style.display = "none";
}

function startQuiz() {
    const urlParams = new URLSearchParams(window.location.search);

    console.log("Study Mode:", studyMode);

    // --- 語源そのものルート専用の処理 ---
    if (studyMode === "etymology") {

        //  level と category を読み込む
        const targetLevel = (urlParams.get('level') || "").toLowerCase().trim();
        const targetCat = (urlParams.get('cat') || "").trim();

        console.log(`Filtering by Level: ${targetLevel}, Category: ${targetCat}`);

        // データ元が他と違うとのことなので、適切なデータ配列（例: etyWordsなど）を使用
        // ここでは仮に etyWords としていますが、読み込んでいる変数名に合わせてください
        selectedWords = etymology.filter(w => {
            const wLevel = (w.level || w.Level || "").toString().toLowerCase().trim();
            const wCat = (w.category || w.Category || "").toString().trim();
            return wLevel === targetLevel && wCat === targetCat;
        });

    } else if (studyMode === "rootgroup") {
        // 語源タグでの絞り込み（setNameを使用）
        selectedWords = words.filter(w => {
            if (!w.etymology_tags) return false;
            return w.etymology_tags.includes(setName);
        });

    } else if (studyMode === "area") {
        // 分野での絞り込み（setNameを使用）
        selectedWords = words.filter(w => {
            return w.field === setName;
        });

    } else if (studyMode === "quick") {
        // クイック学習：分野を問わず全単語からランダムに出題
        selectedWords = words.slice();
    }


    if (studyOrder === "random") {
        for (let i = selectedWords.length - 1; i > 0; i--) {
            const r = Math.floor(Math.random() * (i + 1));
            // 分割代入で1行で入れ替え
            [selectedWords[i], selectedWords[r]] = [selectedWords[r], selectedWords[i]];
        }
    }

    // 出題数の指定があれば、そこで切り詰める（疲れている日向けの「5問だけ」等）
    if (studyCount && studyCount !== "all") {
        const limit = Number(studyCount);
        if (!Number.isNaN(limit) && limit > 0) {
            selectedWords = selectedWords.slice(0, limit);
        }
    }

    console.log("Selected Words Count:", selectedWords.length);
    console.log("Selected Words:", selectedWords);


    if (selectedWords.length === 0) {
        alert("問題が見つかりませんでした。条件を確認してください。");
        return;
    }

    // ✕にした問題を正解するまで繰り返し出題するためのキューを準備する
    studyQueue = selectedWords.slice();
    totalUniqueWords = studyQueue.length;
    missedWordsSet = new Set();
    quizHistoryLog = [];
    correctCount = 0;
    streak = 0;

    const total = totalUniqueWords;

    // 1. 残り問題数の初期値をセット（全問題数）
    const countElem = document.getElementById('remainingCount');
    if (countElem) {
        countElem.innerText = total;
    }

    // 2. プログレスバーの初期値をセット（0%）
    const progressElem = document.getElementById('studyProgress');
    if (progressElem) {
        progressElem.style.width = "0%";
    }

    // 準備ができたら最初の問題を表示


    renderQuestion();
}

//現在の出題を管理
function renderQuestion() {
    currentWord = studyQueue[0];

    // 新しい問題が来たことがわかるように、問題文をふわっと表示
    playCardAnim(document.querySelector(".question-section"), "medety-anim-pop");

    //問題の言語
    if (studyLanguage === "en-jp") {

        if (studyMode === "etymology") {
            document.getElementById("question").textContent = currentWord.tag;
        }

        else {
            document.getElementById("question").textContent = currentWord.word;
            medetySpeak(currentWord.word); // 英単語が出題されたときは発音する
        }

    }   else if (studyLanguage === "jp-en") {

        document.getElementById("question").textContent = currentWord.meaning;

    }

    document.getElementById("answer").textContent = "";
    document.getElementById("hint").textContent = ""
    document.querySelector(".basic-button .answer-button").style.display = "flex";
    document.querySelector(".basic-button .next-question-button").style.display = "none";

}


//答えを表示する関数
function showAnswer() {
    //答えの言語
    if (studyLanguage === "en-jp") {
            document.getElementById("answer").textContent = currentWord.meaning;
    }   else if (studyLanguage === "jp-en") {

        if (studyMode === "etymology") {
            document.getElementById("answer").textContent = currentWord.tag;
        } else {
            document.getElementById("answer").textContent = currentWord.word;
        }

    }

    playCardAnim(document.getElementById("answer"), "medety-anim-pop");

    document.querySelector(".basic-button .answer-button").style.display = "none";
    document.querySelector(".basic-button .next-question-button").style.display = "flex";
}


//ヒントを表示する関数
function showHint() {
    if (studyMode === "etymology") {
        document.getElementById("hint").textContent = "ヒントなし";
    } else {
        const tags = currentWord.etymology_tags;

            let randomTag = ""

            //語源ごとの場合はその語源を除外
            if (studyMode === "rootgroup") {
                const otherTags = tags.filter(tag => tag !== setName);

                if (otherTags.length === 0) {
                    document.getElementById("hint").textContent = "";
                return;
                }

                // ランダムに1つ選ぶ
                randomTag = otherTags[Math.floor(Math.random() * otherTags.length)];

            } else if (studyMode === "area" || studyMode === "quick") {
                // ランダムに1つ選ぶ
                randomTag = tags[Math.floor(Math.random() * tags.length)];
            }

            console.log(studyMode)
            console.log(randomTag)



            // 配列から意味を探す
            const entry = etymology.find(e => e.tag === randomTag);
            console.log(entry)
            //ヒントの言語による向き
            if (studyLanguage === "en-jp") {
                if (entry) {
                    document.getElementById("hint").textContent = `${entry.tag} = ${entry.meaning}`;
                } else {
                    document.getElementById("hint").textContent = "ヒントなし";
                }

            }   else if (studyLanguage === "jp-en") {
                if (entry) {
                    document.getElementById("hint").textContent = `${entry.meaning} = ${entry.tag}`;
                } else {
                    document.getElementById("hint").textContent = "ヒントなし";
                }
            }

    }

}




// 正解数を逐次数える、次に進むか終了する関数
// isOk が false（✕）の問題は、正解するまでキューの末尾に積み直して繰り返し出題する
function nextQuestion(isOk) {
    const card = document.getElementById("studyCard");
    ensureQuizAudio();

    const finishedWord = studyQueue.shift();
    const promptText = document.getElementById("question").textContent;
    const answerText = document.getElementById("answer").textContent;

    if (isOk) {
        // 一度も✕になっていない単語だけ、初出正解としてスコアに数える
        // （これまでの「correctCount / total」の意味をそのまま維持するため）
        if (!missedWordsSet.has(finishedWord)) {
            correctCount++;
        }
        streak++;
        playCardAnim(card, "medety-feedback-correct");
        spawnCheerText(cheerMessages[Math.floor(Math.random() * cheerMessages.length)]);
        sfxQuizCorrect();
    } else {
        missedWordsSet.add(finishedWord);
        studyQueue.push(finishedWord); // 正解するまで繰り返し出題する
        streak = 0;
        playCardAnim(card, "medety-feedback-wrong");
        sfxQuizWrong();
    }
    updateStreakBadge();

    quizHistoryLog.push({ prompt: promptText, answer: answerText, isCorrect: isOk });

    // --- ここで表示を更新する ---
    const remaining = studyQueue.length; // ✕は末尾に戻るだけなので、これで「未マスター数」を正しく表せる

    // 1. 残り問題数の数字を更新
    const countElem = document.getElementById('remainingCount');
    if (countElem) {
        countElem.innerText = remaining;
    }

    // 2. プログレスバーの伸びを更新（マスターした単語の割合）
    const progressElem = document.getElementById('studyProgress');
    if (progressElem) {
        const mastered = totalUniqueWords - remaining;
        const percentage = totalUniqueWords > 0 ? (mastered / totalUniqueWords) * 100 : 100;
        progressElem.style.width = `${percentage}%`;
    }
    // ----------------------------

    if (studyQueue.length > 0) {
        renderQuestion();
    } else {
        finishQuiz();
    }
}

function finishQuiz() {
    try {
        localStorage.setItem("medetyStudyLastResult", JSON.stringify({
            setLabel: setName,
            score: correctCount,
            total: totalUniqueWords,
            history: quizHistoryLog,
            savedAt: Date.now(),
        }));
    } catch (e) {}
    const resultUrl = `studyresult.html?set=${encodeURIComponent(setName)}&result=${correctCount}&total=${totalUniqueWords}`;
    location.href = resultUrl;
}
