// 学習の記録（連続日数・累計単語数）をブラウザ内だけで管理する軽量な仕組み
// サーバーを使わないので、端末やブラウザを変えると記録は引き継がれません

const MEDETY_LOG_KEY = "medetyStudyLog";

function medetyTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function medetyLoadLog() {
    try {
        const raw = localStorage.getItem(MEDETY_LOG_KEY);
        const log = raw ? JSON.parse(raw) : null;
        return log && Array.isArray(log.dates) ? log : { dates: [], totalWords: 0 };
    } catch (e) {
        return { dates: [], totalWords: 0 };
    }
}

function medetySaveLog(log) {
    try {
        localStorage.setItem(MEDETY_LOG_KEY, JSON.stringify(log));
    } catch (e) {
        // 保存できなくても学習自体は続けられるようにそのまま無視する
    }
}

// 学習セッションが終わったときに呼ぶ：今日の日付を記録し、累計単語数を加算する
function medetyRecordSession(wordsCount) {
    const log = medetyLoadLog();
    const today = medetyTodayStr();
    if (!log.dates.includes(today)) {
        log.dates.push(today);
    }
    log.totalWords = (log.totalWords || 0) + (Number(wordsCount) || 0);
    medetySaveLog(log);
}

// 連続学習日数を計算する（今日まだ学習していなくても、昨日までの連続記録は0にしない）
function medetyCalcStreak() {
    const log = medetyLoadLog();
    const dateSet = new Set(log.dates);
    const cursor = new Date();

    if (!dateSet.has(medetyTodayStr())) {
        cursor.setDate(cursor.getDate() - 1);
    }

    let streak = 0;
    while (true) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        if (!dateSet.has(key)) break;
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
}

function medetyStudiedToday() {
    return medetyLoadLog().dates.includes(medetyTodayStr());
}

function medetyTotalWords() {
    return medetyLoadLog().totalWords || 0;
}


// ===== コース学習（レベル別ユニット）の進捗管理 =====
// { "beginner": [0, 1, 2], "basic": [0, 5] } のように、完了したユニット番号を レベルごとに配列で保持する
const MEDETY_COURSE_KEY = "medetyCourseProgress";

function medetyLoadCourseProgress() {
    try {
        const raw = localStorage.getItem(MEDETY_COURSE_KEY);
        const data = raw ? JSON.parse(raw) : null;
        return data && typeof data === "object" ? data : {};
    } catch (e) {
        return {};
    }
}

function medetySaveCourseProgress(data) {
    try {
        localStorage.setItem(MEDETY_COURSE_KEY, JSON.stringify(data));
    } catch (e) {
        // 保存できなくても学習自体は続けられるようにそのまま無視する
    }
}

// 指定レベル・ユニットを「完了」として記録する
function medetyMarkUnitDone(level, unitIndex) {
    if (!level) return;
    const data = medetyLoadCourseProgress();
    const key = level.toLowerCase();
    if (!Array.isArray(data[key])) data[key] = [];
    const idx = Number(unitIndex);
    if (!data[key].includes(idx)) {
        data[key].push(idx);
    }
    medetySaveCourseProgress(data);
}

function medetyIsUnitDone(level, unitIndex) {
    const data = medetyLoadCourseProgress();
    const key = (level || "").toLowerCase();
    return Array.isArray(data[key]) && data[key].includes(Number(unitIndex));
}

// 指定レベルの完了ユニット数を返す
function medetyCompletedUnitCount(level) {
    const data = medetyLoadCourseProgress();
    const key = (level || "").toLowerCase();
    return Array.isArray(data[key]) ? data[key].length : 0;
}

// 指定レベルの中で、最初に見つかった「未完了」のユニット番号を返す（次にやるべきユニット）
function medetyNextUnit(level, totalUnits) {
    const data = medetyLoadCourseProgress();
    const key = (level || "").toLowerCase();
    const done = new Set(Array.isArray(data[key]) ? data[key] : []);
    for (let i = 0; i < totalUnits; i++) {
        if (!done.has(i)) return i;
    }
    return totalUnits > 0 ? totalUnits - 1 : 0;
}

// ホーム画面の「コースの続き」用：最後に取り組んでいた分野グループを記録／取得する
const MEDETY_LAST_GROUP_KEY = "medetyLastCourseGroup";

function medetySetLastCourseGroup(groupId) {
    try { localStorage.setItem(MEDETY_LAST_GROUP_KEY, groupId); } catch (e) {}
}

function medetyGetLastCourseGroup() {
    try { return localStorage.getItem(MEDETY_LAST_GROUP_KEY) || ""; } catch (e) { return ""; }
}


// ===== レベルアップテストの合否管理 =====
// { "osteology:beginner": true, ... } のように、合格した「グループ:レベル」を記録する
const MEDETY_LEVEL_TEST_KEY = "medetyLevelTestsPassed";

function medetyLoadLevelTests() {
    try {
        const raw = localStorage.getItem(MEDETY_LEVEL_TEST_KEY);
        const data = raw ? JSON.parse(raw) : null;
        return data && typeof data === "object" ? data : {};
    } catch (e) {
        return {};
    }
}

function medetySaveLevelTests(data) {
    try { localStorage.setItem(MEDETY_LEVEL_TEST_KEY, JSON.stringify(data)); } catch (e) {}
}

function medetyMarkLevelTestPassed(groupId, level) {
    const data = medetyLoadLevelTests();
    data[`${groupId}:${level}`] = true;
    medetySaveLevelTests(data);
}

function medetyIsLevelTestPassed(groupId, level) {
    return !!medetyLoadLevelTests()[`${groupId}:${level}`];
}
