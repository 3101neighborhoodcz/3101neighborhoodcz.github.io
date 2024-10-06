const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const gamePage = urlParams.get('aqua');
const gameIframe = document.getElementById("aquagame");
const title = document.getElementById('GmeTitle');
const author = document.getElementById('GmeAuthor');
const pgeTitle = document.getElementById("OrgTitleName");
window.addEventListener('DOMContentLoaded',async()=>{
 jso = await fetch('/js/game.json');
  gms = await jso.json();
  const dat = gms[gamePage]
  gameIframe.src = dat.Iframe
  title.innerHTML = dat.Title
 author.innerHTML = dat.Author
  pgeTitle.innerHTML = dat.PageTitle
        if (localStorage.getItem("default") == 'false') {
        document.getElementsByTagName('link')[1].href = localStorage.getItem("iconcloak"),
    document.title = localStorage.getItem("titlecloak") 
        } else if (localStorage.getItem("default") == 'true'){
                document.getElementsByTagName('link')[1].href = "https://aquagxmes.github.io/img/aqua.ico",
               document.title = document.getElementById('OrgTitleName').innerHTML
        }
 })
 function refreshGame() {
  document.getElementById('aquagame').src = gms[gamePage].Iframe
}
