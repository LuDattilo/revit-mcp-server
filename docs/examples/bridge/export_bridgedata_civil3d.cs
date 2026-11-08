var al=(Alignment)Tr.GetObject(Civ.GetAlignmentIds()[0],OpenMode.ForRead);
Profile fg=null; foreach(ObjectId pid in al.GetProfileIds()){var p=(Profile)Tr.GetObject(pid,OpenMode.ForRead); if(p.Name=="Berkmar FG Design") fg=p;}
TinSurface eg=null; foreach(ObjectId id in Civ.GetSurfaceIds()){var s=Tr.GetObject(id,OpenMode.ForRead) as TinSurface; if(s!=null&&s.Name=="EG") eg=s;}
double x0=0,y0=0,x1=0,y1=0; al.PointLocation(12219.73,0,ref x0,ref y0); al.PointLocation(12935.71,0,ref x1,ref y1);
var prof=new List<double[]>(); for(double s=12210;s<=12950;s+=10){prof.Add(new[]{s,Math.Round(fg.ElevationAt(s),3)});}
var gr=new List<double[]>(); foreach(var s in new[]{12219.73,12227.22,12497.22,12708.62,12928.62,12935.71}) foreach(var o in new[]{-30.0,-18.0,0.0,18.0,30.0}){double x=0,y=0; al.PointLocation(s,o,ref x,ref y); double z=double.NaN; try{z=eg.FindElevationAtXY(x,y);}catch{} gr.Add(new[]{s,o,Math.Round(z,2)});}
return new{p0=new[]{x0,y0},p1=new[]{x1,y1},bearingDeg=Math.Atan2(y1-y0,x1-x0)*180/Math.PI,prof,gr};
