//////////////////////////////////////////////////////////////////
// NanoScope: A simple social news aggregator.                  //
// Copyright (C) 2015 CrispQ Information Technologies Pvt. Ltd. //
// Created by Sumukh Barve.                                     //
//////////////////////////////////////////////////////////////////
//
// CONSTANTS:
//
UP = "UP";
DOWN = "DOWN";
//
// COLLECTION(S):
//
Posts = new Mongo.Collection("posts"); // post:: title, url, authorname, createdAt, upvoters, downvoters, hotscore
//
// UTIL FUNCTIONS:
//
var assertLogin = function () {
    if (!Meteor.userId()) {
        alert("Please login.");
        throw new Meteor.Error("not-authorized");
    }    
};
var log = function (x, base) {
    base = base || Math.E;
    return Math.log(x) / Math.log(base);
};
var log10 = function (x) {
    return log(x, 10);
};
var getHotscore = function (upvoters, downvoters, createdAt) {
    var t = createdAt - new Date("2005-12-08"),
        x = upvoters.length - downvoters.length,
        y = (x === 0) ? 0 : (x < 0 ? -1 : +1),
        absX = Math.abs(x),
        z = (absX >= 1) ? absX : 1;
    return log10(z) + (y * t / 45000);
};
var arrContains = function (arr, elm) {
    return arr.indexOf(elm) !== -1;
};
var arrShallowCopy = function (arr) {
    return arr.map(function (x) {return x;});
};
if (Meteor.isServer) {
    //
    // PUBLICATION(S):
    //
    Meteor.publish("posts", function () {
        return Posts.find();
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
        }//,
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
        "submit #newPost": function (evt) {
            evt.preventDefault();
            assertLogin(); // Error thrower;
            var title = evt.target.title.value,
                url = evt.target.url.value;
            Meteor.call("newPost", title, url, function (error, result) {
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
    newPost: function (title, url) {
        assertLogin();
        var now = new Date(),
            post = Posts.findOne({url: url});
        if (post) {
            throw new Meteor.Error("url-exists");   
        }
        Posts.insert({
            title: title,
            url: url,
            authorname: Meteor.user().username,
            createdAt: now,
            upvoters: [],
            downvoters: [],
            hotscore: getHotscore([], [], now)
        });
    },
    vote: function (direction, postId) {
        assertLogin(); // Error thrower
        var votername = Meteor.user().username,
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
            throw new Meteor.Error("already-provoted");
        }
        if (arrContains(antivoters, votername)) {
            i = antivoters.indexOf(votername);
            antivoters.splice(i, 1);
        }
        provoters.push(votername);
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
    }//,
});
