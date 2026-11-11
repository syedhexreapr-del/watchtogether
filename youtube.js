let player;

function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    width: "100%",
    height: "500",
    videoId: "",
    events: {
      onReady: onPlayerReady,
    },
  });
}

function onPlayerReady() {
  console.log("YouTube player ready");
}
