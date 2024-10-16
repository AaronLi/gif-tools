
const durationDisplay = document.getElementById("durationDisplay");
const transitionDurationSelector = document.getElementById("transitionDuration");
const framerateDisplay = document.getElementById("framerateDisplay");
const framerateSelector = document.getElementById("framerate");
const startImage = document.getElementById("startImage");
const endImage = document.getElementById("endImage");
const previewImage = document.getElementById("preview");
const canvas = new OffscreenCanvas(100, 100);
const ctx = canvas.getContext('2d');

const DEFAULT_DURATION = 3;
const DEFAULT_FRAMERATE = 10;

const CropOption = {
    CropToStart: "CropToStart",
    CropToEnd: "CropToEnd",
    PadToStart: "PadToStart",
    PadToEnd: "PadToEnd"
}

const generationSettings = {
    duration: DEFAULT_DURATION,
    framerate: DEFAULT_FRAMERATE,
    crop: CropOption.CropToStart
}

// Add animation duration slider visual
durationDisplay.textContent = parseFloat(transitionDurationSelector.value).toFixed(1)

transitionDurationSelector.addEventListener("input", function(event){
    const inputValue = parseFloat(event.target.value).toFixed(1);
    durationDisplay.textContent = inputValue;
    generationSettings.duration = inputValue;
    enqueueRender();
})

// Add framerate slider visual
framerateDisplay.textContent = parseFloat(framerateSelector.value).toFixed(0)

framerateSelector.addEventListener("input", function(event){
    const inputValue = parseFloat(event.target.value).toFixed(0);
    framerateDisplay.textContent = inputValue;
    generationSettings.framerate = inputValue;
    enqueueRender();
})

// Add selected crop event listener
function getSelectedCrop() {
    const selectedOption = document.querySelector('input[name="crop"]:checked').value
    generationSettings.crop = selectedOption;
    enqueueRender();
}

document.getElementsByName("crop").forEach(e=>e.addEventListener("input", getSelectedCrop))

startImage.addEventListener("change", function(event){
    if(generationSettings.startImage == null) {
        generationSettings.startImage = document.createElement("img");
    }

    generationSettings.startImage.src = URL.createObjectURL(event.target.files[0]);

    generationSettings.startImage.onload = function(){
        console.log("Loaded start image", generationSettings.startImage, "size", generationSettings.startImage.width, "x", generationSettings.startImage.height)
        enqueueRender();
    };
})
endImage.addEventListener("change", function(event){
    if(generationSettings.endImage == null) {
        generationSettings.endImage = document.createElement("img");
    }

    generationSettings.endImage.src = URL.createObjectURL(event.target.files[0]);

    generationSettings.endImage.onload = function(){
        console.log("Loaded end image", generationSettings.endImage, "size", generationSettings.endImage.width, "x", generationSettings.endImage.height)
        enqueueRender();
    };
})

var renderTask = null;

function enqueueRender() {
    clearTimeout(renderTask);
    renderTask = setTimeout(doRender, 500);
}

function doRender() {
    console.log("Render!");
    if(generationSettings.startImage == null) {
        console.log("Missing start image");
        return;
    }

    if(generationSettings.endImage == null) {
        console.log("Missing end image");
        return;
    }

    var startImageData;
    var endImageData;

    switch (generationSettings.crop) {
        case CropOption.CropToStart:
        case CropOption.PadToStart:
            canvas.width = generationSettings.startImage.width;
            canvas.height = generationSettings.startImage.height;

            ctx.drawImage(generationSettings.startImage, 0, 0);
            startImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const endImageScale = calculateScaledSize(generationSettings.startImage, generationSettings.endImage, generationSettings.crop === CropOption.CropToStart);

            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const endImageDrawX = generationSettings.startImage.width / 2 - endImageScale.width / 2;
            const endImageDrawY = generationSettings.startImage.height / 2 - endImageScale.height / 2;

            ctx.drawImage(generationSettings.endImage, endImageDrawX, endImageDrawY, endImageScale.width, endImageScale.height);
            endImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            break;
        case CropOption.CropToEnd:
        case CropOption.PadToEnd:
            canvas.width = generationSettings.endImage.width;
            canvas.height = generationSettings.endImage.height;

            ctx.drawImage(generationSettings.endImage, 0, 0);
            endImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const startImageScale = calculateScaledSize(generationSettings.endImage, generationSettings.startImage, generationSettings.crop === CropOption.CropToEnd);

            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const startImageDrawX = generationSettings.endImage.width / 2 - startImageScale.width / 2;
            const startImageDrawY = generationSettings.endImage.height / 2 - startImageScale.height / 2;

            ctx.drawImage(generationSettings.startImage, startImageDrawX, startImageDrawY, startImageScale.width, startImageScale.height);
            startImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            break;
    }

    const totalFrames = Math.ceil(generationSettings.duration * generationSettings.framerate);
    console.log("Rendering", totalFrames, "frames");
    gif = new GIF({
        workers: 4,
        quality: 10
    });

    gif.addFrame(startImageData, {copy: true, delay: 1500});
    for(frame = 0; frame<=totalFrames; frame++){
        gif.addFrame(interpolateImages(startImageData.data, endImageData.data, frame/totalFrames, canvas.width), {copy: true, delay: 1000/generationSettings.framerate});
    }
    gif.addFrame(endImageData, {copy: true, delay: 2000});

    gif.on('finished', function(blob) {
        const gifUrl = URL.createObjectURL(blob);
        console.log("Render complete");
        previewImage.src = gifUrl;
    })

    gif.render();
}

function interpolateImages(a, b, blend, width) {
    const alpha = 1 - blend;
    const dataOut = new Uint8ClampedArray(a.length);
    for(i = 0; i<a.length; i++) {
        dataOut[i] = a[i] * alpha + b[i] * blend;
    }

    return new ImageData(dataOut, width);
}

function calculateScaledSize(target, source, cropToTarget) {
    const targetAspectRatio = target.width / target.height;
    const sourceAspectRatio = source.width / source.height;

    if(targetAspectRatio > sourceAspectRatio){
        // target is wider than source
        if(cropToTarget){
            const scaleFactor = target.width / source.width;
            return {
                width: target.width,
                height: source.height * scaleFactor
            }
        } else {
            const scaleFactor = target.height / source.height;
            return {
                width: source.width * scaleFactor,
                height: target.height
            }
        }
    } else if(targetAspectRatio < sourceAspectRatio) {
        // target is taller than source

        if(cropToTarget){
            const scaleFactor = target.height / source.height;
            return {
                width: source.width * scaleFactor,
                height: target.height
            }
        } else {
            const scaleFactor = target.width / source.width;
            return {
                width: target.width,
                height: source.height * scaleFactor
            }
        }
    } else {
        // target is same size as source
        return {width: target.width, height: target.height};
    }
}

window.onload = function(){
    startImage.value = "";
    endImage.value = "";
    generationSettings.startImage = null;
    generationSettings.endImage = null;
}