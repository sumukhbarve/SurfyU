//////////////////////////////////////////////////////////////////
// nanoscope: A simple social news aggregator.                  //
// Copyright (C) 2015 CrispQ Information Technologies Pvt. Ltd. //
// Created by Sumukh Barve.                                     //
//////////////////////////////////////////////////////////////////
//
// CONSTANTS:
//
var UP = "UP"; // Note: Un-`var` if using multiple files.
var DOWN = "DOWN";
var EPOCH = new Date("2005-12-08");
var ADMIN_NAMES = ["yoda"]; // HARD-CODED
//
// COLLECTION(S):
//
Posts = new Mongo.Collection("posts"); // post:: title, url, authorname, createdAt, upvoters, downvoters, hotscore
//
// UTIL FUNCTIONS:
//
var assert = function (bool, errorMsg, alertMsg) {
    errorMsg = errorMsg || "assertion-failed";
    if (!bool) {
        if (alertMsg && Meteor.isClient) {
            alert(alertMsg);
        }
        throw new Meteor.Error(errMsg);
    }
    return true;
};
var assertLogin = function () {
    assert(Meteor.userId(), "not-authorized", "Please login.");
};
var log = function (x, base) {
    base = base || Math.E;
    return Math.log(x) / Math.log(base);
};
var log10 = function (x) {
    return log(x, 10);
};
var getHotscore = function (upvoters, downvoters, createdAt) {
    var t = createdAt - EPOCH,
        x = upvoters.length - downvoters.length,
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
    if (!user) { return false; }
    return arrContains(ADMIN_NAMES, user.username);
};
var assertAdmin = function () {
    assert(isAdmin(), "admin-required");
};
var isAlias = function (user) {
    return Object.keys(user.services).length === 0;
};
var assertAlias = function (user) {
    assert(isAlias(user), "bad-alias");
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
    // TEMPLATE HELPERS:
    //
    Template.body.helpers({
        posts: function () {
            return Posts.find({}, {sort: {hotscore: -1}});
        },
        currentUserIsAdmin: isAdmin//,
    });
    Template.post.helpers({
        netscore: function () {
            return this.upvoters.length - this.downvoters.length;
        },
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
    });
    //
    // EVENTS:
    //
    Template.body.events({
        "submit #addPost": function (evt) {
            evt.preventDefault();
            assertLogin(); // Error thrower;
            var title = evt.target.title.value,
                url = evt.target.url.value,
                aliasname = "";
            if (isAdmin()) {
                aliasname = evt.target.aliasname.value || "";   
            }
            Meteor.call("addPost", title, url, aliasname, function (error, result) {
                if (error) {
                    console.log(error);
                    alert("Error: " + error.message);
                    throw error;
                }
                evt.target.title.value = "";
                evt.target.url.value = "";
                alert("Great! Your links has been added.\n" +
                        "Thanks for posting it.  :)");           
            });
        },
    });
    Template.post.events({
        "click #upvote": function () {
            Meteor.call("vote", UP, this._id);
        },
        "click #downvote": function () {
            Meteor.call("vote", DOWN, this._id);
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
// METHODS:
//
Meteor.methods({
    addPost: function (title, url, aliasname) {
        assertLogin(); // Error thrower
        var now = new Date(),
            post = Posts.findOne({url: url}),
            author = Meteor.user(),
            authorname = author.username,
            alias = null;
        if (post) {
            throw new Meteor.Error("url-exists");   
        }
        if (aliasname) {
            assertAdmin(); // Error thrower
            alias = Meteor.users.findOne({username: aliasname});
            if (!alias) {
                // ==> Account doesn't exist... create one:
                Accounts.createUser({username: aliasname});
            } else {
                assertAlias(alias); // Error thrower
                // Ensures that `alias` is indeed an alias.
            }
            authorname = aliasname;
        }
        Posts.insert({
            title: title,
            url: url,
            authorname: authorname,
            createdAt: now,
            upvoters: [],
            downvoters: [],
            hotscore: getHotscore([], [], now)
        });
    },
    vote: function (direction, postId) {
        assertLogin(); // Error thrower
        var voter = Meteor.user(),
            votername = voter.username,
            post = Posts.findOne({_id: postId}),
            provoters = null, antivoters = null;
            i = null;
        if (direction === UP) {
            provoters = post.upvoters;      // alias
            antivoters = post.downvoters;   // alias
        } else {
            provoters = post.downvoters;    // alias
            antivoters = post.upvoters;     // alias
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
        Posts.update(
            {_id: postId},
            {$set: {
                upvoters: post.upvoters,
                downvoters: post.downvoters,
                hotscore: getHotscore(
                    post.upvoters,
                    post.downvoters,
                    post.createdAt//,
                )//,
            }}//,
        );
    },
});
