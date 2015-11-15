//
// PUBLICATION(S):
//
Meteor.publish("posts", function () {
    return Posts.find({});
});

