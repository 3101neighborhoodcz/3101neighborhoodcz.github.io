const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const newsPage = urlParams.get('article');
const title = document.getElementById('articleTitle');
const txt = document.getElementById('articleText');
window.addEventListener('DOMContentLoaded',async()=>{
 jso = await fetch('/js/news.json');
  nws = await jso.json();
  const dat = nws[newsPage]
  title.innerHTML = dat.title
  txt.innerHTML = dat.text
 })
