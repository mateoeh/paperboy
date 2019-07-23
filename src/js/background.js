const BASE_URL = "https://hacker-news.firebaseio.com/v0";

class NoSuchUserError extends Error {
    constructor(message) {
        super(message);
        this.name = "NoSuchUserError";
    }
}

const hasOwnProperty = function hasOwnProperty(object, property) {
    return Object.prototype.hasOwnProperty.call(object, property);
};

const deepCopy = function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
};

const setBadgeCount = function setBadgeCount(count) {
    if (count === 0) {
        browser.browserAction.setBadgeText({ text: "" });
    } else {
        browser.browserAction.setBadgeText({ text: count.toString() });
    }
};

let decodingTextArea = null;
// Make HTML suitable for .textContent
const toPlaintext = function toPlaintext(html) {
    // Strip HTML tags
    let sanitized = html.replace("<p>", "\n");
    sanitized = html.replace(/<[^>]*>/g, "");

    // Decode HTML entities. <textarea> will preserve tags (to avoid XSS)
    // https://stackoverflow.com/a/7394787
    if (decodingTextArea === null) {
        decodingTextArea = document.createElement("textarea");
    }
    decodingTextArea.innerHTML = sanitized;
    return decodingTextArea.value;
};

const getUserJson = function getUserJson(username) {
    return fetch(`${BASE_URL}/user/${username}.json`)
        .then(res => res.json())
        .then(json => {
            if (json === null) throw new NoSuchUserError();
            else return json;
        });
};

// Get all of user's posts within the last week
const getRecentPosts = async function getRecentPosts(userJson) {
    const now = Math.floor(Date.now() / 1000);
    const recents = [];

    for (let i = 0; i < userJson.submitted.length; i += 1) {
        const postId = userJson.submitted[i];

        // Run these sequentially so loop can break early
        /* eslint-disable no-await-in-loop */
        const post = await fetch(`${BASE_URL}/item/${postId}.json`);
        const json = await post.json();
        /* eslint-enable */

        if (json.time > now - 60 * 60 * 24 * 7) {
            recents.push(json);
        } else {
            break;
        }
    }

    return recents;
};

const getChildren = function getChildren(recentJsons, after) {
    const childIds = recentJsons
        .filter(item => hasOwnProperty(item, "kids"))
        .flatMap(item => item.kids)
        .filter(id => id > after)
        .sort((a, b) => b - a); // high to low
    return Promise.all(
        childIds.map(id =>
            fetch(`${BASE_URL}/item/${id}.json`).then(res => res.json())
        )
    );
};

const toReplies = function toReplies(childJsons) {
    return childJsons
        .filter(json => !hasOwnProperty(json, "deleted"))
        .filter(json => !hasOwnProperty(json, "dead"))
        .map(
            json =>
                new paperboy.Reply(
                    json.id,
                    json.by,
                    json.time,
                    toPlaintext(json.text)
                )
        );
};

/* <storage convenience methods> */
const storeLastRefresh = function storeLastRefresh(
    username,
    lastRefreshCache = {}
) {
    const lastRefreshCopy = deepCopy(lastRefreshCache);
    lastRefreshCopy[username] = Math.floor(Date.now() / 1000);
    return paperboy.STORAGE.set({ lastRefresh: lastRefreshCopy });
};

const storeReplies = function storeReplies(
    username,
    fetchedReplies,
    repliesCache = {}
) {
    const repliesCopy = deepCopy(repliesCache);
    repliesCopy[username] = repliesCache[username] || [];
    repliesCopy[username] = fetchedReplies.concat(repliesCopy[username]);
    setBadgeCount(repliesCopy[username].length);
    return paperboy.STORAGE.set({ replies: repliesCopy });
};

const storeHighestSeen = function storeHighestSeen(
    username,
    fetchedReplies,
    highestSeenCache = {}
) {
    if (fetchedReplies.length === 0) return null;
    const highestSeenCopy = deepCopy(highestSeenCache);
    highestSeenCopy[username] = fetchedReplies[0].postId;
    return paperboy.STORAGE.set({ highestSeen: highestSeenCopy });
};
/* </storage convenience methods> */

const handleErrors = function handleErrors(error) {
    console.log(`Error during refresh: ${error}`);
    if (error instanceof NoSuchUserError) {
        paperboy.send({ event: paperboy.NO_SUCH_USER });
    } else {
        paperboy.send({ event: paperboy.NETWORK_ERROR });
    }
};

const refresh = async function refresh() {
    const {
        username,
        replies,
        lastRefresh,
        highestSeen
    } = await paperboy.STORAGE.get([
        "username",
        "replies",
        "lastRefresh",
        "highestSeen"
    ]);

    if (typeof username === "undefined") {
        // No username set, nothing to fetch
        return;
    }

    try {
        setBadgeCount(replies[username].length);
    } catch (err) {
        // Something is undefined. Ignore
    }

    let minimumId;
    if (
        typeof highestSeen !== "undefined" &&
        typeof highestSeen[username] !== "undefined"
    ) {
        // Don't fetch previously seen replies
        minimumId = highestSeen[username];
    } else {
        // First run for this user, fetch all replies
        minimumId = 0;
    }

    getUserJson(username)
        .then(getRecentPosts)
        .then(recentJsons => getChildren(recentJsons, minimumId))
        .then(toReplies)
        .then(fetchedReplies =>
            Promise.all([
                storeHighestSeen(username, fetchedReplies, highestSeen),
                storeReplies(username, fetchedReplies, replies),
                storeLastRefresh(username, lastRefresh)
            ])
        )
        .then(() => paperboy.send({ event: paperboy.REFRESHED }))
        .catch(handleErrors);
};

browser.browserAction.setBadgeBackgroundColor({ "color": "#ff6600" });
window.setInterval(refresh, 10 * 60 * 1000);
refresh();

browser.runtime.onMessage.addListener(msg => {
    if (msg.event === paperboy.REFRESH) {
        refresh();
    } else if (msg.event === paperboy.BADGE_UPDATE) {
        setBadgeCount(msg.count);
    }
});
