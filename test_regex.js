const text = "Phan gia đại $123$ chời đất ơi, quỷ thần ơi /\\$ ok gì z $";
let result = text.replace(/(?<![\\$])\$([^$\n]+?)\$/g, (m, t) => {
  return "<math>" + t + "</math>";
});
console.log(result);
