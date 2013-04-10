###############################################################################################
## Function washer.AV in R-language
## Original Author : Andrea Venturini (andrea.venturini@bancaditalia.it)
## Modified by Wisdom Omuya for 10gen mongoperf tool
## Venturini, A. (2011). Time Series Outlier Detection: A New Non Parametric Methodology 
## (Washer). Statistica 71: 329-344.
################################################################################################
washer.AV = function( dati, metric, date )
{          # dati structure:  
           # example:              test     		     date      threads     Value    ...
           #             ------------------------     ----------  ----------   -----  --------  
           #             Queries::IntNonIDFindOne     2009-12-31      1         20.1    ...
           #             Queries::IntNonIDRange       2009-12-31      16        21.0    ...
           #                        ...
           #             Queries::IntNonIDFindOne     2009-12-31      12        21.0    ...
           #                        ...
###############################################################################################
AV      =  function(y) {   # y matrix 3 columns (y1 y2 y3) and n rows
                    AV=array(0,length(y[,1]))
                   100*(2*y[,2]-y[,1]-y[,3])/(median(y[,1]+y[,2]+y[,3])+ y[,1]+y[,2]+y[,3]) 
            }
       		# output array AV
###############################################################################################
test.AV =  function(AV) {  # AV array n rows
				t(rbind(test_AV=abs(AV-median(AV))/mad(AV),AV=AV,n=length(AV),
				   		median_AV=median(AV),mad_AV=mad(AV),
				   		std_AV=sd(AV),madindex_AV=mad(AV)*1000/150  ))
			}
           # col      1      2   3        5          6         7           8
           # output: test / AV / n /  median(AV) / mad(AV) / std(AV) / madindex
###############################################################################################
	if (min(dati[,4])> 0) {
		dati=dati[which(!is.na(dati[,4])),]
		dati=dati[order(dati[,1],dati[,3],dati[,2]),]
		fen=rownames( table(dati[,1]) )
		nfen=length(fen)
		out=NA 
		#for each metric
		for ( fi in 1:nfen) 
		{ 
			cat("processing", metric, "on", fen[fi], "for", date, "\n")
			time=rownames( table(dati[which(fen[fi]==dati[,1]),2]) ) 
			n=length(time)
			for ( i in 2:(n-1) ) 
			{  
				#get rolling window for this metric
				c1=which(as.character(dati[,2])==time[i-1] & dati[,1] == fen[fi])
				c2=which(as.character(dati[,2])==time[i  ] & dati[,1] == fen[fi])
				c3=which(as.character(dati[,2])==time[i+1] & dati[,1] == fen[fi])
				mat=matrix(0,3,max(length(c1),length(c2),length(c3))+1)

				if (length(c1) > 5)
				{
					j=1
					for ( k in 1:length(c1) )   
					{  
						mat[1,j]=c1[k]
						if (!is.na(match(c1[k]+1,c2))) {
							mat[2,j]=c1[k]+1 
							if(!is.na(match(c1[k]+2,c3))) {
								mat[3,j]=c1[k]+2
								j=j+1 
							}
						}
					}
					mat=mat[,which(mat[3,]!=0)]
					#get window values
					y=cbind(dati[mat[1,],4],
					dati[mat[2,],4],
					dati[mat[3,],4])
					y1=dati[mat[1,],4]
					y2=dati[mat[2,],4]
					y3=dati[mat[3,],4]

					out=rbind(out,data.frame(test=fen[fi],run_date=time[i],
						thread_count=dati[mat[2,],3],y1=y1,y2,y3,test.AV(AV(y))))
				}
			}
		}
		rownames(out)=(1:length(out[,1])-1)
		washer.AV=out[2:length(out[,1]),]
	} else print(" . . . zero or negative y:  t r a n s l a t i o n   r e q u i r e d !!!")
}
