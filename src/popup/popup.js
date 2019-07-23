const body = document.querySelector("body");
const usernameForm = document.querySelector("form");
const usernameInput = document.querySelector("#username-input");
const lastRefreshSpan = document.querySelector("#last-refresh");
const clearAllButton = document.querySelector("#clear-all");
const replyTemplate = document.querySelector("template");
const emptyLabel = document.querySelector("#no-notifications");

let repliesCache = null;
let usernameCache = null;

const removeAllReplyElements = function removeAllReplyElements() {
    const divs = body.getElementsByClassName("reply-container");
    while (divs[0]) {
        body.removeChild(divs[0]);
    }
};

const showEmptyState = function showEmptyState(isEmpty) {
    emptyLabel.style.display = isEmpty ? "inline-block" : "none";
    clearAllButton.style.visibility = isEmpty ? "hidden" : "visible";
};

const clearReply = function clearReply(clickEvent) {
    const { postId } = clickEvent.target;
    repliesCache[usernameCache] = repliesCache[usernameCache].filter(
        reply => reply.postId !== postId
    );
    paperboy.send({
        event: paperboy.BADGE_UPDATE,
        count: repliesCache[usernameCache].length
    });
    showEmptyState(repliesCache[usernameCache].length === 0);
    body.removeChild(clickEvent.target.parentElement);
    paperboy.STORAGE.set({ replies: repliesCache });
};

const clearAll = function clearAll(clickEvent) {
    clickEvent.preventDefault();
    repliesCache[usernameCache] = [];
    paperboy.send({
        event: paperboy.BADGE_UPDATE,
        count: 0
    });
    showEmptyState(true);
    removeAllReplyElements();
    paperboy.STORAGE.set({ replies: repliesCache });
};

const bindReplyToContainer = function bindReplyToContainer(reply, container) {
    const link = container.querySelector(".item-link");
    link.href = `https://news.ycombinator.com/item?id=${reply.postId}`;
    link.textContent = `Reply from ${reply.author}`;
    link.postId = reply.postId;
    link.addEventListener("click", clearReply);

    const time = container.querySelector(".time-label");
    time.textContent = paperboy.timeAgoString(reply.timestamp);

    const content = container.querySelector(".content");
    content.textContent = reply.content;

    const clear = container.querySelector(".clear");
    clear.postId = reply.postId;
    clear.addEventListener("click", clearReply);
};

const showRepliesForUser = function showRepliesForUser(replies, username) {
    repliesCache = replies;
    usernameCache = username;

    for (let i = 0; i < replies[username].length; i += 1) {
        const container = document.importNode(replyTemplate.content, true);
        bindReplyToContainer(replies[username][i], container);
        body.appendChild(container);
    }

    showEmptyState(replies[username].length === 0);
};

const didRefresh = async function didRefresh() {
    const { username, replies, lastRefresh } = await paperboy.STORAGE.get([
        "username",
        "replies",
        "lastRefresh"
    ]);

    if (
        typeof username === "undefined" ||
        typeof replies === "undefined" ||
        typeof replies[username] === "undefined"
    ) {
        showEmptyState(true);
        paperboy.send({
            event: paperboy.BADGE_UPDATE,
            count: 0
        });
    } else {
        usernameInput.value = username;
        lastRefreshSpan.textContent = `Last refresh: ${paperboy.timeAgoString(
            lastRefresh[username]
        )}`;
        removeAllReplyElements();
        showRepliesForUser(replies, username);
    }
};

const saveUsername = function saveUsername(clickEvent) {
    clickEvent.preventDefault();
    lastRefreshSpan.textContent = "Refreshing...";
    paperboy.STORAGE.set({ username: usernameInput.value });
    paperboy.send({ event: paperboy.REFRESH });
};

window.addEventListener("DOMContentLoaded", didRefresh);
usernameForm.addEventListener("submit", saveUsername);
clearAllButton.addEventListener("click", clearAll);

browser.runtime.onMessage.addListener(msg => {
    switch (msg.event) {
        case paperboy.REFRESHED:
            didRefresh();
            break;
        case paperboy.NETWORK_ERROR:
            lastRefreshSpan.textContent = "Network error";
            break;
        case paperboy.NO_SUCH_USER:
            lastRefreshSpan.textContent = "User doesn't exist";
            paperboy.send({
                event: paperboy.BADGE_UPDATE,
                count: 0
            });
            removeAllReplyElements();
            showEmptyState(true);
            break;
        default:
            // Ignore
    }
});
