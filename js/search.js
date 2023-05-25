const games = document.querySelector(".gamescontainer");
const search = document.getElementById("srchbar");
function gamefilter() {
    var filter = search.value.toUpperCase();
    for (i = 0; i < games.children.length; i++) {
        var a = games.children[i].getElementsByTagName("p")[0];
        if (a.innerHTML.toUpperCase().indexOf(filter) > -1) {
            games.children[i].style.display = "";
        } else {
            games.children[i].style.display = "none";
        }
    }
}
search.addEventListener("keyup", gamefilter);
