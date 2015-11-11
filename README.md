Nanoscope is a social news hub, inspired by reddit, built with meteor.

### Blog post &mdash; [***Nanoscope: The Inspiration***](http://blog.crispq.com/2015/11/nanoscope-inspiration.html)

### Implemented features:
✔ Posting: Users can submit posts (AKA links).  
✔ Voting: Users can vote (and un-vote) on posts.  
✔ Aliasing: Admins can submit posts via alias accounts.  
✔ Biasing: Admins can favor or disfavor posts by adding bias weights.  
✔ Backdating: Admins can backdate their submissions.  
✔ Deletion: Users can delete their posts. Admins can delete any post.  
✔ Youtube Support: Embed videos directly in the feed.  

#### Features being worked on:
✘ Image Support: Display images, allow uploads. (Partial)  
✘ Tagging: Users can use #hashtags to label posts.
✘ Mentions: Users can use @username to call out other users.


### Installation:
```
$ git clone https://github.com/sumukhbarve/nanoscope.git
$ cd nanoscope
$ meteor
```
- Open a browser, go to `http://localhost:3000`.
- Register the usernames `admin` and `yoda`. These have admin rights.
- Poke around, see how things work. Use admin and non-admin accounts.

### Deployment:
```
$ meteor deploy example.meteor.com
```
Above, replace `example` with a subdomain of choice.

### More to come...
