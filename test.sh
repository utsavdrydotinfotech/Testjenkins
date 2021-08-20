echo "Start!"
for p in test.txt
do
	if [ $p=dist ]
    	    then
			echo "eveything is good" > good.txt
                	ls
	else
			echo "ok did't do anything " > free.txt
	fi
done

