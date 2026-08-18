window.crmAuth = {

async requireAuth(){

const { data, error } =
await window.supabaseClient.auth.getSession();

if(error || !data.session){

location.href = "index.html";

return null;

}

return data.session;

},


async signIn(email,password){

return window.supabaseClient.auth.signInWithPassword({

email,
password

});

},


async signOut(){

await window.supabaseClient.auth.signOut();

location.href = "index.html";

}

};


document.addEventListener(
"DOMContentLoaded",
()=>{

const btn =
document.getElementById("logoutBtn");

if(btn){

btn.addEventListener(
"click",
()=>window.crmAuth.signOut()
);

}

});
