//////////////////////////////////////////////////////////////////
//                                                              //
// Nanoscope: A social news hub.                                //
// Copyright (C) 2015 CrispQ Information Technologies Pvt. Ltd. //
//                                                              //
//////////////////////////////////////////////////////////////////
//
// CONSTANTS: Note: Un-`var` variables if using multiple files.
//
var UP = "UP", DOWN = "DOWN";
var EPOCH = new Date("2005-12-08");
var ADMIN_NAMES = ["admin", "yoda"]; // HARD-CODED
var HOT = "HOT", NEW = "NEW", TOP = "TOP";
var IMAGE_EXTENSIONS = [
    ".jpg", ".jpeg",
    ".png",
    ".gif",
    ".tif", ".tiff",
    ".bmp"//,
];
//
// COLLECTION(S):
//
Posts = new Mongo.Collection("posts");
// Properties: title, url, authorname, createdAt, upvoters,
//              downvoters, bias, netscore, hotscore
//
// UTILITY FUNCTIONS:
//
var assert = function (bool, errorMsg, alertMsg) {
    errorMsg = errorMsg || "assertion-failed";
    if (!bool) {
        if (Meteor.isClient && alertMsg) {
            alert(alertMsg);
        }
        throw new Meteor.Error(errorMsg);
    }
    return true;
};
var assertLogin = function () {
    return assert(Meteor.userId(), "login-required", "Please login.");
};
var log = function (x, base) {
    base = base || Math.E;
    return Math.log(x) / Math.log(base);
};
var log10 = function (x) {
    return log(x, 10);
};
var getNetscore = function (upvoters, downvoters, bias) {
    return (upvoters.length - downvoters.length) + bias;
};
var getHotscore = function (netscore, createdAt) {
    var t = createdAt - EPOCH,
        x = netscore,
        y = (x === 0) ? 0 : (x < 0 ? -1 : +1),
        absX = Math.abs(x),
        z = (absX >= 1) ? absX : 1;
    return log10(z) + (y * t / 45000);
};
var arrContains = function (arr, elm) {
    return arr.indexOf(elm) !== -1;
};
var isAdmin = function () {
    var user = Meteor.user();
    return user && arrContains(ADMIN_NAMES, user.username);
};
var assertAdmin = function () {
    return assert(isAdmin(), "admin-required");
};
var isAdminOrAuthor = function (post) {
    var user = Meteor.user();
    return user && (isAdmin() || post.authorname === user.username);
};
var assertAdminOrAuthor = function (post) {
    return assert(isAdminOrAuthor(post), "admin-or-author-required");
};
var isAlias = function (user) {
    return Object.keys(user.services).length === 0;
};
var assertAlias = function (user) {
    return assert(isAlias(user), "bad-alias");
};
var arrShallowCopy = function (arr) {
    return arr.map(function (x) {return x;});
};
var arrRemoveElement = function (arr, elm, count) {
    count = count || arr.length;
    var i = null;
    while (count > 0) {
        i = arr.indexOf(elm);
        if (i === -1) { break; }
        arr.splice(i, 1);
        count -= 1;
    }
};
var isValidDateStr = function (dateStr) {
    if (dateStr === "") {
        return true;
        // Empty `dateStr` indicates that current time should be used.
    }
    var date = new Date(dateStr);
    return String(date) !== "Invalid Date";
};
var assertValidDateStr = function (dateStr) {
    return assert(isValidDateStr(dateStr), "invalid-date", "Invalid Date");
};
var endswith = function (haystack, needle) {
    // ECMA 5 doesn't include String.prototype.endsWith
    var i = haystack.lastIndexOf(needle);
    return haystack.slice(i) === needle;
};

if (Meteor.isServer) {
    //
    // PUBLICATION(S):
    //
    Meteor.publish("posts", function () {
        return Posts.find({});
    });
}
if (Meteor.isClient) {
    //
    // SUBSCRIPTION(S):
    //
    Meteor.subscribe("posts");
    //
    // SESSION DEFAULTS:
    //
    //  // As of now, there are no session variables.
    //
    // TEMPLATE HELPERS:
    //
    Template.registerHelper("isAdmin", isAdmin);
    Template.registerHelper(HOT, HOT);
    Template.registerHelper(NEW, NEW);
    Template.registerHelper(TOP, TOP);
    Template.registerHelper("context", function () {
        return JSON.stringify(this);
    });
    Template.posts.helpers({
        posts: function () {
            var sortSpec = null;
            if (this.sortBy === HOT) {
                sortSpec = {hotscore: -1};
            } else if (this.sortBy === NEW) {
                sortSpec = {createdAt: -1};
            } else {
                assert (this.sortBy === TOP);
                sortSpec = {netscore: -1};
            }
            return Posts.find({}, {sort: sortSpec});
        }//,
    });
    Template.post.helpers({
        fromNow: function () {
            return moment(this.createdAt).fromNow();
        },
        domain: function () {
            var a = document.createElement("a");
            a.href = this.url;
            return a.hostname;
        },
        hasDownvoted: function () {
            if (!Meteor.userId()) { return false; }
            return arrContains(this.downvoters, Meteor.user().username);
        },
        hasUpvoted: function () {
            if (!Meteor.userId()) { return false; }
            return arrContains(this.upvoters, Meteor.user().username);
        },
        lengthscore: function () {
            return this.upvoters.length - this.downvoters.length;
        },
        isAdminOrAuthor: function () {
            return isAdminOrAuthor(this);
        },
        isImageLike: function () {
            var url = this.url;
            return IMAGE_EXTENSIONS.some(function (ext) {
                return endswith(url, ext);
            });
        }//,
    });
    //
    // EVENTS:
    //
    Template.body.events({
        "submit #addPost": function (evt) {
            evt.preventDefault();
            var title = evt.target.title.value,
                url = evt.target.url.value,
                aliasname = "", dateStr = "";
            if (isAdmin()) {
                aliasname = evt.target.aliasname.value;
                dateStr = evt.target.dateStr.value;
                assertValidDateStr(dateStr); // Error thrower
            }
            Meteor.call("addPost", title, url, aliasname, dateStr, function (error, result) {
                if (error) {
                    console.log(error);
                    alert("Error: " + error.message);
                    throw error;
                }
                evt.target.title.value = "";
                evt.target.url.value = "";
                $("a[href=#tab_new]").tab("show");
            });
        }//,
    });
    Template.post.events({
        "click #upvote": function () {
            assertLogin(); // Error thrower, extra-pre-check
            Meteor.call("castVote", UP, this._id);
        },
        "click #downvote": function () {
            assertLogin(); // Error thrower, extra-pre-check
            Meteor.call("castVote", DOWN, this._id);
        },
        "change .bias": function (evt) {
            assertAdmin(); // Error thrower, extra-pre-check
            var postId = this._id,
                bias = Number(evt.target.value);
            Meteor.call("addBias", postId, bias);
        },
        "click .delete": function () {
            assertAdminOrAuthor(this); // Error thrower, extra-pre-check
            if (confirm("Are you sure?")) {
                Meteor.call("deletePost", this._id);
            }
        }//,
    });
    //
    // ACCOUNTS:
    //
    Accounts.ui.config({
        passwordSignupFields: "USERNAME_AND_OPTIONAL_EMAIL"//,
    });
}
//
// HELPERS FOR Meteor.methods:
//
var getCreationDate = function (dateStr) {
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
        } else {
            assertAlias(alias); // Error thrower
            // Ensures that `alias` is indeed an alias.
        }
        return aliasname;
    },
    addPost: function (title, url, aliasname, dateStr) {
        assertLogin(); // Error thrower
        assertValidDateStr(dateStr);
        if (aliasname || dateStr) {
            assertAdmin(); // Error thrower
        }
        var post = Posts.findOne({url: url}),
            author = Meteor.user(),
            authorname = Meteor.call("getAuthorname", author.username, aliasname),
            createdAt = getCreationDate(dateStr);
        assert (!post, "url-exists", "URL already exists.");
        Posts.insert({
            title: title,
            url: url,
            authorname: authorname,
            createdAt: createdAt,
            upvoters: [authorname],
            downvoters: [],
            bias: 0,
            netscore: 1,
            hotscore: getHotscore(1, createdAt)
        });
    },
    castVote: function (direction, postId) {
        assertLogin(); // Error thrower
        var voter = Meteor.user(),
            votername = voter.username,
            post = Posts.findOne({_id: postId}),
            provoters = null, antivoters = null,
            netscore = null, hotscore = null, i = null;
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
