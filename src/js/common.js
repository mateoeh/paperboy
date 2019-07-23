// FIXME
// eslint-disable-next-line no-var, no-use-before-define
var paperboy = paperboy || {};

paperboy.Reply = function Reply(postId, author, timestamp, content) {
    this.postId = postId;
    this.author = author;
    this.timestamp = timestamp;
    this.content = content;
};

// Constants
paperboy.STORAGE = browser.storage.local;
// Message types
paperboy.REFRESH = "refresh";
paperboy.REFRESHED = "refreshed";
paperboy.NETWORK_ERROR = "network_error";
paperboy.NO_SUCH_USER = "no_such_user";
paperboy.BADGE_UPDATE = "badge_update";

/**
 * Sends a message to all background scripts
 * @param {Object} msg - any Object. `msg.event` should be `paperboy.{REFRESH,
 * REFRESHED, NETWORK_ERROR, NO_SUCH_USER, BADGE_UPDATE}`
 */
paperboy.send = function sendMessage(msg) {
    browser.runtime.sendMessage(msg);
};

/**
 * Generates a "time ago" string for a given timestamp e.g. '2 minutes ago'
 *
 * @param {number} unixTime - Seconds since Unix epoch
 * @return {string} Time ago string
 */
/* eslint-disable nonblock-statement-body-position,curly */
paperboy.timeAgoString = function timeAgoString(unixTime) {
    const { floor } = Math;
    const now = floor(Date.now() / 1000);
    const diff = now - unixTime;

    if (diff < 2)
        // 00:00:02
        return "just now";
    if (diff < 60)
        // 00:01:00
        return `${diff} seconds ago`;
    if (diff < 60 * 2)
        // 00:02:00
        return "1 minute ago";
    if (diff < 60 * 60)
        // 01:00:00
        return `${floor(diff / 60)} minutes ago`;
    if (diff < 60 * 60 * 2)
        // 02:00:00
        return "1 hour ago";
    if (diff < 60 * 60 * 24)
        // 24:00:00
        return `${floor(diff / 60 / 60)} hours ago`;
    if (diff < 60 * 60 * 24 * 2)
        // 48:00:00
        return "1 day ago";
    if (diff < 60 * 60 * 24 * 7)
        // 7 days
        return `${floor(diff / 60 / 60 / 24)} days ago`;
    if (diff < 60 * 60 * 24 * 7 * 2)
        // 14 days
        return "1 week ago";
    if (diff < 60 * 60 * 24 * 30.44)
        // 30.44 days
        return `${floor(diff / 60 / 60 / 24 / 7)} weeks ago`;
    if (diff < 60 * 60 * 24 * 30.44 * 2)
        // 60.88 days
        return "1 month ago";
    if (diff < 60 * 60 * 24 * 30.44 * 12)
        // 1 year
        return `${floor(diff / 60 / 60 / 24 / 30.44)} months ago`;
    if (diff < 60 * 60 * 24 * 30.44 * 12 * 2)
        // 2 years
        return "1 year ago";
    return `${floor(diff / 60 / 60 / 24 / 30.44 / 12)} years ago`;
};
/* eslint-enable */
