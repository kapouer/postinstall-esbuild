document.addEventListener('coco', async e => {
	const res = await fetch("/test");
	console.log(res);
});
