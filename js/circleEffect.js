function createCircle(event) {
  const circle = document.createElement("div");
  circle.classList.add("circle");

  const x = event.clientX;
  const y = event.clientY;

  // Set the size and position of the circle
  circle.style.width = '25px';  // Set a size for the circle
  circle.style.height = '25px'; // Set a size for the circle
  circle.style.left = `${x - 50}px`; // Center the circle on the click
  circle.style.top = `${y - 50}px`;  // Center the circle on the click

  // Append the circle to the container
  document.querySelector("body").appendChild(circle);

  // Remove the circle after the animation is done
  circle.addEventListener('animationend', () => {
      circle.remove();
  });
}
