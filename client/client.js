// Copyright (C) 2015 CrispQ Information Technologies Pvt. Ltd.

//
// SESSION VARIABLE(S) (INIT):
//
Session.set("postsLoaded", false);
//
// SUBSCRIPTION(S):
//
Meteor.subscribe("posts", function () {
    Session.set("postsLoaded", true);
});
//
// TEMPLATE HELPERS:
//
Template.registerHelper("config", config);
Template.registerHelper("isAdmin", isAdmin);
Template.registerHelper(HOT, HOT);
Template.registerHelper(NEW, NEW);
Template.registerHelper(TOP, TOP);
Template.registerHelper("postsLoaded", function () {
    return Session.get("postsLoaded");
});
Template.registerHelper("debugContext", function () {
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
        if (startswith(a.hostname, "www.")) {
            return a.hostname.slice(4);
        }
        // Otherwise...
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
    },
    youtubeId: function () {
        var m = this.url.match(RE.YOUTUBE);
        if (m) { return m[1]; } else { return false; }
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
            aliasname = "", dateStr = "",
            $tab_new = $("a[href=#tab_new]"),
            $tab_submit = $("a[href=#tab_submit]");
        if (isAdmin()) {
            aliasname = evt.target.aliasname.value;
            dateStr = evt.target.dateStr.value;
            assertValidDateStr(dateStr); // Error thrower, extra-pre-check
        }
        Meteor.call("addPost", title, url, aliasname, dateStr, function (error, result) {
            if (error) {
                $tab_submit.tab("show");
                debugError = error;
                alert("Error: " + error.error);
                throw error;
            }
            evt.target.title.value = "";
            evt.target.url.value = "";
            $("#imgPreview").attr("src", "").hide();
        });
        $tab_new.tab("show");
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
        assert(!isNaN(bias), "number-required");
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
//
// POSTIMAGE:
//
window.postimageCallback = function (bbcode) {
    var imgsrc = bbcode.match(RE.POSTIMAGE)[1];
    $("#addPost input[name=url]").val(imgsrc);
    $("#imgPreview").attr("src", imgsrc).show();
    alert("Image uploaded.\nA preview shall soon become visibile.");
};
