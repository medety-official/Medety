// コース学習（分野グループ × レベル × レッスン）の組み立てロジック
// study.html（レッスン一覧の表示）と coursequiz.html（出題）の両方から呼ばれる共通処理

const COURSE_UNIT_SIZE = 5;         // 1レッスンあたりの単語数
const COURSE_REVIEW_INTERVAL = 3;   // 何レッスンごとに復習レッスンを挟むか
const COURSE_NODE_SIZE = 5;         // 1つの円（チェックポイント）にまとめるレッスン数
const COURSE_REVIEW_SIZE = 10;      // 復習レッスンの出題数
const COURSE_TEST_SIZE = 10;        // レベルアップテストの出題数
const COURSE_TEST_PASS_RATE = 0.8;  // テストの合格ライン（正答率）

// 「分野ごと」タブのアコーディオン分類に合わせた、分野グループの定義
// ※ note: 内分泌系 / 頭蓋内の構造 は分野ごとタブにまだ反映されていない分野だが、
//   コース学習では単語が漏れないよう、意味の近いグループに含めている
const COURSE_GROUPS = {
    osteology: {
        label: "骨学", emoji: "🦴",
        fields: ["総論", "脊柱", "胸郭", "上肢", "下肢", "頭蓋"],
    },
    muscle: {
        label: "筋肉", emoji: "💪",
        fields: ["筋肉総論", "頭部の筋", "頸部の筋", "上肢の筋", "胸部の筋", "腹部の筋", "背部の筋", "脊柱周囲の筋", "腰部の筋", "下肢の筋"],
    },
    bloodvessel: {
        label: "血管", emoji: "🩸",
        fields: ["血管総論・大血管", "頭頸部の血管", "上肢の血管", "胸部の血管", "腹部・骨盤部の血管", "下肢の血管"],
    },
    organ: {
        label: "臓器", emoji: "🫁",
        fields: ["臓器総論", "頭部", "呼吸器系", "循環器系", "消化器系", "泌尿器系", "生殖器系", "内分泌系"],
    },
    nerve: {
        label: "脳・神経", emoji: "⚡",
        fields: ["神経総論", "脳神経", "頭頸部の神経", "上腕の神経", "胸部の神経", "後頭部・背部の神経", "腹部・骨盤部の神経", "下肢の神経", "脊髄", "自律神経系", "脳", "頭蓋内の構造"],
    },
    others: {
        label: "その他", emoji: "✨",
        fields: ["その他"],
    },
};
const COURSE_GROUP_ORDER = ["osteology", "muscle", "bloodvessel", "organ", "nerve", "others"];

// レベルの並び順（unclassified = スプレッドシートでレベル未設定の単語をまとめる仮のレベル）
const COURSE_LEVEL_RANK = { beginner: 0, basic: 1, bedside: 2, advanced: 3, enthusiast: 4 };
const COURSE_LEVEL_ORDER = ["beginner", "basic", "bedside", "advanced", "enthusiast", "unclassified"];
const COURSE_LEVEL_LABELS = {
    beginner: "Beginner", basic: "Basic", bedside: "Bedside",
    advanced: "Advanced", enthusiast: "Enthusiast", unclassified: "レベル外",
};

function medetyWordLevelKey(w) {
    const lv = (w.level || "").toString().trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(COURSE_LEVEL_RANK, lv) ? lv : "unclassified";
}

// 配列をシャッフルした「コピー」を返す（元の配列は変更しない）
function medetyShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const r = Math.floor(Math.random() * (i + 1));
        [a[i], a[r]] = [a[r], a[i]];
    }
    return a;
}

// 配列からランダムに n 個選ぶ（取り組むたびに変わる＝毎回シャッフルし直す）
function medetyRandomSample(arr, n) {
    return medetyShuffle(arr).slice(0, Math.min(n, arr.length));
}

// 指定した分野グループの「プラン」（レッスン／復習／レベルアップテストを順番に並べたもの）を組み立てる
// レッスンで出題する単語（words）は毎回同じ＝抜け漏れが出ない。
// 復習・テストの words は「出題プール」（この時点までに学んだ単語 / このレベルの全単語）で、
// 実際にどの単語が出るかは出題のたびにランダムに選び直す（coursequiz.html 側で行う）。
// 戻り値: [{ type: "lesson"|"review"|"test", level, words: [...], passRate? }, ...]
function medetyBuildCoursePlan(allWords, groupId) {
    const group = COURSE_GROUPS[groupId];
    if (!group) return [];

    const fieldSet = new Set(group.fields);
    const groupWords = allWords.filter(w => fieldSet.has((w.field || "").toString().trim()));

    // レベルごとに単語を仕分け（元の登録順を保持）
    const byLevel = {};
    groupWords.forEach((w, i) => {
        const key = medetyWordLevelKey(w);
        if (!byLevel[key]) byLevel[key] = [];
        byLevel[key].push({ w, i });
    });

    const presentLevels = COURSE_LEVEL_ORDER.filter(lv => byLevel[lv] && byLevel[lv].length > 0);

    const plan = [];
    presentLevels.forEach((lv, levelIdx) => {
        const levelWords = byLevel[lv].sort((a, b) => a.i - b.i).map(x => x.w);

        let covered = [];
        let sinceReview = 0;
        for (let i = 0; i < levelWords.length; i += COURSE_UNIT_SIZE) {
            const chunk = levelWords.slice(i, i + COURSE_UNIT_SIZE);
            plan.push({ type: "lesson", level: lv, words: chunk });
            covered = covered.concat(chunk);
            sinceReview++;

            const isLastChunk = i + COURSE_UNIT_SIZE >= levelWords.length;
            if (sinceReview >= COURSE_REVIEW_INTERVAL && !isLastChunk) {
                plan.push({ type: "review", level: lv, words: covered.slice() }); // 出題プール（この時点まで）
                sinceReview = 0;
            }
        }

        // 次のレベルが存在するなら、その手前にレベルアップテストを挟む
        if (levelIdx < presentLevels.length - 1) {
            plan.push({
                type: "test",
                level: lv,
                words: levelWords.slice(), // 出題プール（このレベル全体）
                passRate: COURSE_TEST_PASS_RATE,
            });
        }
    });

    return plan;
}

// プランの各項目に「ロック状態」を付与する（手前のレベルアップテストに合格していなければロック）
function medetyApplyCourseLocks(plan, groupId) {
    let gateOpen = true;
    return plan.map(item => {
        const locked = !gateOpen;
        if (item.type === "test") {
            gateOpen = medetyIsLevelTestPassed(groupId, item.level);
        }
        return Object.assign({}, item, { locked });
    });
}

// 1つの項目が完了しているかどうか（テストは合格しているかどうかで判定）
function medetyIsCourseItemDone(groupId, item, index) {
    if (item.type === "test") {
        return medetyIsLevelTestPassed(groupId, item.level);
    }
    return medetyIsUnitDone(groupId, index);
}


// ===== ここから、実際の出題（問題タイプ）を組み立てるロジック =====
// coursequiz.html から呼ばれる

// 単語の語源タグ（tag）または、その日本語訳（meaning）＋ダミーを混ぜた選択肢を作る
// mode: "tag"（語源タグそのもの） | "meaning"（語源タグの日本語訳）
function medetyBuildTagChoiceQuestion(promptLang, mode, word, allEtymology) {
    const correctTags = Array.isArray(word.etymology_tags) ? word.etymology_tags : [];
    let correctAnswers, pool;

    if (mode === "meaning") {
        const tagToMeaning = {};
        allEtymology.forEach(e => { if (e.tag) tagToMeaning[e.tag] = e.meaning; });
        correctAnswers = Array.from(new Set(correctTags.map(t => tagToMeaning[t]).filter(Boolean)));
        const correctSet = new Set(correctAnswers);
        pool = Array.from(new Set(allEtymology.map(e => e.meaning).filter(m => m && !correctSet.has(m))));
    } else {
        correctAnswers = correctTags.slice();
        const correctSet = new Set(correctAnswers);
        pool = Array.from(new Set(allEtymology.map(e => e.tag).filter(t => t && !correctSet.has(t))));
    }

    const optionCount = 6;
    const wrongCount = Math.max(optionCount - correctAnswers.length, 2);
    const wrongs = medetyRandomSample(pool, wrongCount);

    return {
        kind: "tagselect",
        mode: mode,
        promptLang: promptLang,
        prompt: promptLang === "en" ? word.word : word.meaning,
        word: word,
        correctAnswers: correctAnswers,
        options: medetyShuffle(correctAnswers.concat(wrongs)),
    };
}

// 4択の選択肢（正解1つ＋他の単語からのダミー）を作る。field は "meaning" か "word"
function medetyBuildChoiceOptions(word, candidatePool, field, count) {
    const correct = word[field];
    const others = candidatePool.filter(w => w !== word && w[field] && w[field] !== correct);
    const wrongs = medetyRandomSample(others, count - 1).map(w => w[field]);
    return medetyShuffle([correct].concat(wrongs));
}

// 1問分のデータを組み立てる。
// stage: "tagselect_en" | "tagselect_en_meaning" | "tagselect_jp" | "mc_meaning" | "mc_word"
function medetyBuildQuestion(stage, word, siblingWords, allWords, allEtymology) {
    if (stage === "tagselect_en") {
        return medetyBuildTagChoiceQuestion("en", "tag", word, allEtymology);
    }
    if (stage === "tagselect_en_meaning") {
        return medetyBuildTagChoiceQuestion("en", "meaning", word, allEtymology);
    }
    if (stage === "tagselect_jp") {
        return medetyBuildTagChoiceQuestion("jp", "tag", word, allEtymology);
    }
    const pool = siblingWords.length >= 4 ? siblingWords : allWords;
    if (stage === "mc_meaning") {
        return {
            kind: "choice",
            promptLang: "en",
            prompt: word.word,
            word: word,
            correctAnswer: word.meaning,
            options: medetyBuildChoiceOptions(word, pool, "meaning", 4),
        };
    }
    // mc_word（日本語→英語）
    return {
        kind: "choice",
        promptLang: "jp",
        prompt: word.meaning,
        word: word,
        correctAnswer: word.word,
        options: medetyBuildChoiceOptions(word, pool, "word", 4),
    };
}

// レッスンの出題キューを作る：単語ごとに
// 「英語→タグ／英語→タグの日本語訳／英語→日本語／日本語→英語／日本語→タグ」の順、
// 単語をまたいでラウンドロビン（同じ段階を全単語ぶん終えてから、次の段階に進む）
function medetyBuildLessonQueue(lessonWords, allWords, allEtymology) {
    const stages = ["tagselect_en", "tagselect_en_meaning", "mc_meaning", "mc_word", "tagselect_jp"];
    const queue = [];
    stages.forEach(stage => {
        lessonWords.forEach(word => {
            queue.push(medetyBuildQuestion(stage, word, lessonWords, allWords, allEtymology));
        });
    });
    return queue;
}

// 復習の出題キュー：これまで学んだ単語からランダムに数問、日本語→語源タグ選択
function medetyBuildReviewQueue(coveredWordsPool, allEtymology, count) {
    const sample = medetyRandomSample(coveredWordsPool, count);
    return sample.map(word => medetyBuildQuestion("tagselect_jp", word, coveredWordsPool, coveredWordsPool, allEtymology));
}

// レベルアップテストの出題キュー：レベル内の単語からランダムに数問、日本語→英語タイピング
function medetyBuildTestQueue(levelWordsPool, count) {
    const sample = medetyRandomSample(levelWordsPool, count);
    return sample.map(word => ({
        kind: "typing",
        promptLang: "jp",
        prompt: word.meaning,
        word: word,
        correctAnswer: word.word,
    }));
}
