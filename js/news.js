// Add event listeners to all divs with the 'news' class
document.querySelectorAll('.news_article').forEach(div => {
    div.addEventListener('click', () => {
        const id = div.id; // Get the ID of the clicked div
        const url = `/pages/news/article?article=${id}`; // Construct the URL
        window.location.href = url; // Redirect to the constructed URL
    });
});