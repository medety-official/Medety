
let currentIndex = 0 //現在の問題番号
let correctCount = 0 //現在の正解数
let words = [];
let etymology = [];
let selectedWords = [];

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
    }


    if (studyOrder === "random") {
        for (let i = selectedWords.length - 1; i > 0; i--) {
            const r = Math.floor(Math.random() * (i + 1));
            // 分割代入で1行で入れ替え
            [selectedWords[i], selectedWords[r]] = [selectedWords[r], selectedWords[i]];
        }
    }

    console.log("Selected Words Count:", selectedWords.length);
    console.log("Selected Words:", selectedWords);
    

    if (selectedWords.length === 0) {
        alert("問題が見つかりませんでした。条件を確認してください。");
        return;
    }

    // startQuiz 関数の最後の方に追加
    const total = selectedWords.length;

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
    currentWord = selectedWords[currentIndex];

    //問題の言語
    if (studyLanguage === "en-jp") {

        if (studyMode === "etymology") {
            document.getElementById("question").textContent = currentWord.tag;
        }

        else {
            document.getElementById("question").textContent = currentWord.word;
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

            } else if (studyMode === "area") {
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
function nextQuestion(isOk) {
    if (isOk) correctCount++;

    currentIndex++;

    // --- ここで表示を更新する ---
    const total = selectedWords.length;
    const remaining = total - currentIndex;
    
    // 1. 残り問題数の数字を更新（0未満にならないようMath.maxを使用）
    const countElem = document.getElementById('remainingCount');
    if (countElem) {
        countElem.innerText = Math.max(0, remaining);
    }

    // 2. プログレスバーの伸びを更新
    const progressElem = document.getElementById('studyProgress');
    if (progressElem) {
        const percentage = (currentIndex / total) * 100; // 回答済みの割合
        progressElem.style.width = `${percentage}%`;
    }
    // ----------------------------

    if (currentIndex < total) {
        renderQuestion();
    } else {
        location.href = `studyresult.html?set=${setName}&result=${correctCount}&total=${currentIndex}`;
    }
}
