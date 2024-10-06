const doc = document
const ls = localStorage
document.addEventListener("DOMContentLoaded", function(event) { 
        if (ls.getItem("default") == 'false') {
        doc.getElementsByTagName('link')[1].href = ls.getItem("iconcloak"),
    doc.title = ls.getItem("titlecloak") 
        } else if (ls.getItem("default") == 'true'){
                doc.getElementsByTagName('link')[1].href = "https://aquagxmes.github.io/img/aqua.ico",
                doc.title = doc.getElementById('OrgTitleName').innerHTML
        }
        
        /*fdsfdsf*/
    console.log(document.cookie);
    var visit = getCookie("cookie");
    if (visit == null) {
            ls.setItem("default", true)
        var expire = new Date();
        expire = new Date(expire.getTime() + 7776000000);
        document.cookie = "cookie=here; expires=" + expire;
    }
});
function getCookie(c_name) {
    var c_value = document.cookie;
    var c_start = c_value.indexOf(" " + c_name + "=");
    if (c_start == -1) {
        c_start = c_value.indexOf(c_name + "=");
    }
    if (c_start == -1) {
        c_value = null;
    } else {
        c_start = c_value.indexOf("=", c_start) + 1;
        var c_end = c_value.indexOf(";", c_start);
        if (c_end == -1) {
            c_end = c_value.length;
        }
        c_value = unescape(c_value.substring(c_start, c_end));
    }
    
    return c_value;
}

function off() {
  document.getElementById("overlay").style.display = "none";
}                 

function setico(urle) {
ls.setItem("iconcloak", urle)
}
function setitle(urle) {
ls.setItem("titlecloak", urle)
}
function toggleSettings() {
if (doc.getElementById("settings").style.display == "none"){
document.getElementById("settingToggle").src = "/img/close.png"
doc.getElementById("settings").style.display = ""
} else if (doc.getElementById("settings").style.display == ""){
document.getElementById("settingToggle").src = "/img/setting.png"
doc.getElementById("settings").style.display = "none"
}
}                      
function TitleSetting(thing) {
ls.setItem("default", false)
setitle(thing),
doc.title = ls.getItem("titlecloak")
}
function DefaultSetting() {
ls.setItem("default", true)
setico('https://aquagxmes.github.io/img/aqua.ico'),
setitle(doc.getElementById('OrgTitleName').innerHTML)
doc.getElementsByTagName('link')[1].href = ls.getItem("iconcloak")
doc.title = doc.getElementById('OrgTitleName').innerHTML
}
function IconSetting(thing) {
ls.setItem("default", false)
setico(thing),
doc.getElementsByTagName('link')[1].href = ls.getItem("iconcloak")
}
