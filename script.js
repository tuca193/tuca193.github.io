document.documentElement.className="js";
var st={};try{st=JSON.parse(localStorage.getItem("ssa2")||"{}")}catch(e){}
var items=document.querySelectorAll("li[data-k]"),pb=document.getElementById("pb"),
    total=items.length,done=0,timer;
items.forEach(function(li){
  var i=li.querySelector("input");
  i.checked=!!st[li.dataset.k];
  if(i.checked)done++;
});
function bar(){pb.style.transform="scaleX("+done/total+")"}
bar();
document.addEventListener("change",function(e){
  var el=e.target,li=el.closest&&el.closest("li[data-k]");
  if(li){
    st[li.dataset.k]=el.checked;
    done+=el.checked?1:-1;
    bar();
    clearTimeout(timer);
    timer=setTimeout(function(){
      try{localStorage.setItem("ssa2",JSON.stringify(st))}catch(x){}
    },300);
  }else if(el.classList.contains("ov")&&el.checked){
    var p=el.nextElementSibling;if(p)p.scrollTop=0;
  }
});
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){var o=document.querySelector(".ov:checked");if(o)o.checked=false}
});
