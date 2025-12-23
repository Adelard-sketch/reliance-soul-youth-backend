async function main(){
  const url = 'http://localhost:5000/uploads/gallery/1762722009348-alain.jpg';
  try{
    const res = await fetch(url, { method: 'HEAD' });
    console.log('URL:', url);
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
  }catch(err){
    console.error('Request failed:', err.message);
    process.exit(1);
  }
}

main();
