// Adapted by CrispQ Information Technologies Pvt. Ltd.
// Original author: Sium < admin@postimage.org > (N/A) http://postimage.org/

if (typeof postimage_lang === 'undefined') {
    var postimage_lang = "english";
    var postimage_add_text = "Add image to post";
    function postimage_query_string(postimage_search_name) {
        if (window.location.hash) {
            postimage_query = window.location.hash.substring(1).split("&");
            for (postimage_i = 0; postimage_i < postimage_query.length; postimage_i++) {
                postimage_string_data = postimage_query[postimage_i].split("=");
                if (postimage_string_data[0] == postimage_search_name) {
                    postimage_string_data.shift();
                    return unescape(postimage_string_data.join("="));
                }
            }
        }
        return void(0);
    }
    if (opener) {
        var postimage_text = postimage_query_string("postimage_text");
        if (postimage_text) {
            opener.focus();
            window.close();
            opener.postimageCallback(postimage_text);
        }
    }
    function postimage_upload() {
        areaid = 0;
        window.open("http://postimage.org/index.php?mode=website&areaid=" +
                        areaid + "&hash=1&lang=" + postimage_lang +
                        "&code=hotlink&content=&forumurl=" + escape(document.location.href),
                "postimage", "resizable=yes,width=500,height=400"//,
        );
        return void(0);
    }
}
