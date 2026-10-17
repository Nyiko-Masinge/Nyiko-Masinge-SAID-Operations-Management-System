const {loader}=require('./stage6b-test-support.cjs');
function trustedProgressPost() {
  const POST=loader({'server-only':{}},process.env)('web-app/app/api/mobile/task-progress/route.ts').POST;
  return async(token,weekStart,scheduledWorkId,expectedStatus,status,requestId,reason)=>{
    const response=await POST(new Request('http://localhost/api/mobile/task-progress',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({weekStart,scheduledWorkId,expectedStatus,status,requestId,...(reason?{unableToCompleteReason:reason}:{})})}));
    require('node:assert/strict').equal(response.status,200,JSON.stringify(await response.clone().json()));return response.json();
  };
}
module.exports={trustedProgressPost};
