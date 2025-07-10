const video= document.getElementById("video");
const canvas= document.getElementById("canvas");
const ctx= canvas.getContext("2d");
const filterselect= document.getElementById("filters");
const snap= document.getElementById("snap");
const download= document.getElementById("download");
navigator.mediaDevices.getUserMedia({video:true})
.then(stream =>{
video.srcObject= stream;
})
.catch(err=>{
    alert("Camera Access Denied");
    console.error(err);
}
);
filterselect.addEventListener("change",()=> {
    video.style.filter=filterselect.value;
});
snap.addEventListener("click",()=>{
    canvas.style.display="block";
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.filter = filterselect.value;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/png");
    download.href = imageData;
}
)
download.addEventListener("click", (e) => {
    if (!download.href.includes("data:image")) {
      e.preventDefault();
      alert("Please capture a photo first!");
    }
  });
  