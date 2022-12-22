const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const img = entry.target;
      const src = img.getAttribute('data-src');
      img.setAttribute('src', src);
      img.classList.remove('lazy-load');
      observer.unobserve(img);
  }
});
});

function imagesChanged() {
    const images = document.querySelectorAll('.lazy-load');

    images.forEach((img) => {
      observer.observe(img);
  });
}

function clearImages() {
    const images = document.querySelectorAll('.lazy-load');

    images.forEach((img) => {
        try {
          observer.unobserve(img);
      } catch(err) {}
    });

    // Clear gallery
    $("#page-gallery").empty();
}

function getGalleryEl(prompt, imgSrc, width, height) {

    return `
        <a href="#" class="gallery-el wide-${width} tall-${height}">
            <div class="overlay">
                <p>${prompt}</p>
            </div>
            <img data-src="${imgSrc}" class="gallery-img lazy-load"/>
        </a>
    `;
}

function processImageFeed(files) {

    clearImages();

    for(let i = 0; i < files.length; i++) {

        // Get width and height in increments of 512
        let width = Math.round(files[i].width / 512);
        let height = Math.round(files[i].height / 512);

        // Convert to aspect rato
        let ar = width / height;
        
        // Determin col and row span
        if(ar >= 2.00) {
            width = 2;
            height = 1;
        }
        else if(ar <= 0.50) {
            width = 1;
            height = 2;
        }
        else {
            width = 1;
            height = 1;
        }

        $("#page-gallery").append(getGalleryEl(files[i].prompt.substring(0, 100) + "...", files[i].imgPath, width, height));
    }

    imagesChanged();
}

function loadImageFeed() {
    $.ajax({
        url: "/api/images/feed",
        type: "GET",
        dataType: "json",
        success: function(data){
            processImageFeed(data);
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
    });
}

function loadSearchQuery(query) {
    $.ajax({
        type: 'GET',
        url: '/api/images/query',
        data: {query},
        success: function(data) {
            processImageFeed(data);
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

function performSearch(event){
   const keycode = (event.keyCode ? event.keyCode : event.which);

   if(keycode != '13')
        return;

    // get query and trim it
    let text = $('#page-search').val();

    // If it's completely empty, refresh feed, otherwise, send a query to the backend
    if(text == "")
        loadImageFeed();
    else
        loadSearchQuery(text)
}

function initiateReindex() {
    clearImages();

    $.ajax({
        type: 'GET',
        url: '/api/images/re-index',
        success: function(data) {
            loadImageFeed();
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

$(document).ready(function() {
    loadImageFeed();
    $('#page-search').keypress(performSearch);
    $('#re-index').click(initiateReindex);
});
