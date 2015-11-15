//////////////////////////////////////////////////////////////////
//                                                              //
// SurfyU: A social web surfing hub.                            //
// Copyright (C) 2015 CrispQ Information Technologies Pvt. Ltd. //
//                                                              //
//////////////////////////////////////////////////////////////////
/* globals Meteor, Template, Mongo, Accounts, moment,
		Posts
*/
//
// CONSTANTS:
//
UP = "UP", DOWN = "DOWN";
EPOCH = new Date("2005-12-08");
ADMIN_NAMES = ["admin", "yoda"]; // HARD-CODED
HOT = "HOT", NEW = "NEW", TOP = "TOP";
IMAGE_EXTENSIONS = [
    ".jpg", ".jpeg",
    ".png",
    ".gif",
    ".tif", ".tiff",
    ".bmp"//,
];
RE = {}; // Container for regular expressions.
RE.YOUTUBE = /^(?:https?:\/\/|\/\/)?(?:www\.|m\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})(?![\w-])/;
// RE.YOUTUBE, via http://stackoverflow.com/questions/7693218/youtube-i-d-parsing-for-new-url-formats
RE.POSTIMAGE = /\[img\](.*?)\[\/img\]/;
//
// COLLECTION(S):
//
Posts = new Mongo.Collection("posts");
// Properties: title, url, authorname, createdAt, upvoters,
//              downvoters, bias, netscore, hotscore
//
// UTILITY FUNCTIONS:
//
assert = function (bool, errorMsg, alertMsg) {
    errorMsg = errorMsg || "assertion-failed";
    alertMsg = alertMsg || errorMsg;
    if (!bool) {
        if (Meteor.isClient) {
            alert(alertMsg);
        }
        throw new Meteor.Error(errorMsg);
    }
    return true;
};
assertLogin = function () {
    return assert(Meteor.userId(), "login-required", "Please login.");
};
log = function (x, base) {
    base = base || Math.E;
    return Math.log(x) / Math.log(base);
};
log10 = function (x) {
    return log(x, 10);
};
getNetscore = function (upvoters, downvoters, bias) {
    return (upvoters.length - downvoters.length) + bias;
};
getHotscore = function (netscore, createdAt) {
    var t = createdAt - EPOCH,
        x = netscore,
        y = (x === 0) ? 0 : (x < 0 ? -1 : +1),
        absX = Math.abs(x),
        z = (absX >= 1) ? absX : 1;
    return log10(z) + (y * t / 45000);
    // Ranking algorithm, via http://amix.dk/blog/post/19588
};
arrContains = function (arr, elm) {
    return arr.indexOf(elm) !== -1;
};
isAdmin = function () {
    var user = Meteor.user();
    return user && arrContains(ADMIN_NAMES, user.username);
};
assertAdmin = function () {
    return assert(isAdmin(), "admin-required");
};
isAdminOrAuthor = function (post) {
    var user = Meteor.user();
    return user && (isAdmin() || post.authorname === user.username);
};
assertAdminOrAuthor = function (post) {
    return assert(isAdminOrAuthor(post), "admin-or-author-required");
};
isAlias = function (user) {
    return Object.keys(user.services).length === 0;
};
assertAlias = function (user) {
    return assert(isAlias(user), "bad-alias");
};
arrRemoveElement = function (arr, elm, count) {
    count = count || arr.length;
    var i = null;
    while (count > 0) {
        i = arr.indexOf(elm);
        if (i === -1) {
            break;
        }
        // ==> FOUND elm
        arr.splice(i, 1);
        count -= 1;
    }
};
isValidDateStr = function (dateStr) {
    if (dateStr === "") {
        return true; // Empty string indicates current time.
    }
    var date = new Date(dateStr);
    return String(date) !== "Invalid Date";
};
assertValidDateStr = function (dateStr) {
    return assert(isValidDateStr(dateStr), "invalid-date");
};
endswith = function (haystack, needle) {
    // ECMA5 doesn't include String.prototype.endsWith
    var i = haystack.lastIndexOf(needle);
    return i !== -1 && haystack.slice(i) === needle;
};
startswith = function (haystack, needle) {
    return haystack.indexOf(needle) === 0;
};


//
// HELPERS FOR Meteor.methods:
//
getCreationDate = function (dateStr) {
    assertValidDateStr(dateStr); // Error thrower
    if (!dateStr) { return new Date(); }
    return new Date(dateStr);
};
updateVoterArrays = function (voteDirection, votername, upvoters, downvoters) {
    var provoters = null, antivoters = null;
    if (voteDirection === UP) {
        provoters = upvoters;
        antivoters = downvoters;
    } else {
        assert(voteDirection === DOWN); // Error thrower
        provoters = downvoters;
        antivoters = upvoters;
    }
    if (arrContains(provoters, votername)) {
        // Undo previous vote:
        arrRemoveElement(provoters, votername, 1);
    } else if (arrContains(antivoters, votername)) {
        // Change vote:
        arrRemoveElement(antivoters, votername, 1);
        provoters.push(votername);
    } else {
        // Fresh vote:
        provoters.push(votername);
    }
};
getThumbnailUrl = function (url) {
    if (Meteor.isClient) {
        return null;
        // Optimistic!!
    }
    assert(Meteor.isServer); // Error thrower
    var endpoint = config.server.EMBEDKIT_ENDPOINT,
        key = config.server.EMBEDKIT_KEY,
        resp = null;
    try {
        resp = HTTP.get(endpoint, {params: {key: key, url: url}});
    } catch (e) {
        console.log(["error =", e]);
        throw new Meteor.Error("url-unreachable");
    }
    assert(resp.statusCode === 200);
    return resp.data.thumbnail_url || null;
};
//
// METHODS:
//
Meteor.methods({
    getAuthorname: function (username, aliasname) {
        // Helps pick between `username` and `aliasname`.
        var alias = null;
        if (!aliasname) {
            return username;
        }
        // ==> Truthy aliasname
        assertAdmin(); // Error thrower
        alias = Meteor.users.findOne({username: aliasname});
        if (!alias) {
            // ==> Account doesn't exist... create one:
            Accounts.createUser({username: aliasname});
            // Account creation happens on the server.
            // That's why this is in Meteor.methods
        } else {
            // ==> Account exists.
            assertAlias(alias); // Error thrower
            // Ensures that `alias` is indeed an alias.
        }
        return aliasname;
    },
    addPost: function (title, url, aliasname, dateStr) {
        assertLogin(); // Error thrower
        assertValidDateStr(dateStr); // Error thrower
        if (aliasname || dateStr) {
            assertAdmin(); // Error thrower
        }
        var thumbnailUrl = getThumbnailUrl(url), // Error thrower
            post = Posts.findOne({url: url}),
            author = Meteor.user(),
            authorname = Meteor.call("getAuthorname", author.username, aliasname),
            createdAt = getCreationDate(dateStr);
        assert (!post, "url-exists", "URL already exists."); // Error thrower
        Posts.insert({
            title: title,
            url: url,
            authorname: authorname,
            createdAt: createdAt,
            upvoters: [authorname],
            downvoters: [],
            bias: 0,
            netscore: 1,
            hotscore: getHotscore(1, createdAt),
            thumbnailUrl: thumbnailUrl//,
        });
    },
    castVote: function (direction, postId) {
        assertLogin(); // Error thrower
        var voter = Meteor.user(),
            votername = voter.username,
            post = Posts.findOne({_id: postId}),
            netscore = null, hotscore = null;
        assert(post, "post-not-found"); // Error thrower
        updateVoterArrays(direction, votername, post.upvoters, post.downvoters);
        netscore = getNetscore(post.upvoters, post.downvoters, post.bias);
        hotscore = getHotscore(netscore, post.createdAt);
        Posts.update(
            {_id: postId},
            {$set: {
                upvoters: post.upvoters,
                downvoters: post.downvoters,
                netscore: netscore,
                hotscore: hotscore//,
            }}//,
        );
    },
    addBias: function (postId, bias) {
        assertAdmin(); // Error thrower
        var post = Posts.findOne({_id: postId}),
            netscore = null, hotscore = null;
        assert(post, "post-not-found");
        netscore = getNetscore(post.upvoters, post.downvoters, bias);
        hotscore = getHotscore(netscore, post.createdAt);
        Posts.update(
            {_id: postId},
            {$set: {
                bias: bias,
                netscore: netscore,
                hotscore: hotscore//,
            }}//,
        );
    },
    deletePost: function (postId) {
        assertLogin();
        var post = Posts.findOne({_id: postId});
        assertAdminOrAuthor(post); // Error thrower
        Posts.remove({_id: postId});
    }//,
});
